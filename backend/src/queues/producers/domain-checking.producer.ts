import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { QUEUE_NAMES } from '../constants/queue-names';
import {
  DomainCheckingJobData,
  DomainCheckingJobResult,
} from '../interfaces/job-data.interface';
import { jobQueueLogs } from '../../database/schema';

@Injectable()
export class DomainCheckingProducer {
  private readonly logger = new Logger(DomainCheckingProducer.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.DOMAIN_CHECKING)
    private readonly checkingQueue: Queue<
      DomainCheckingJobData,
      DomainCheckingJobResult
    >,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async addJob(data: DomainCheckingJobData): Promise<string> {
    const db = this.databaseService.getDb();

    const job = await this.checkingQueue.add('check-domain', data, {
      // Unique ids: BullMQ's default counter restarts when Redis is reset,
      // which would collide with job_queue_logs rows from before.
      jobId: `chk-${randomUUID()}`,
      attempts: this.configService.get<number>('queue.checking.attempts') || 3,
      backoff: this.configService.get('queue.checking.backoff') || {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: this.configService.get('queue.removeOnComplete') || {
        age: 3600,
        count: 1000,
      },
      removeOnFail: this.configService.get('queue.removeOnFail') || {
        age: 86400,
      },
      priority: data.parentJobId ? 5 : 10, // Higher priority for standalone checks
    });

    // Log job creation to database
    try {
      await db.insert(jobQueueLogs).values({
        jobId: job.id as string,
        userId: data.userId,
        queueName: QUEUE_NAMES.DOMAIN_CHECKING,
        jobType: 'check-domain',
        status: 'queued',
        data: data,
        creditsDeducted: data.creditsDeducted.toString(),
        createdAt: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to log job creation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    this.logger.debug(
      `Added checking job ${job.id} for ${data.domains ? `${data.domains.length} domains` : `${(data as any).domain}.${(data as any).tld}`}`,
    );
    return job.id as string;
  }

  async addBulkJobs(
    jobs: DomainCheckingJobData[],
  ): Promise<{ jobIds: string[]; batchId: string }> {
    const batchId = `batch-${Date.now()}`;

    const jobPromises = jobs.map((data) =>
      this.addJob({
        ...data,
        parentJobId: data.parentJobId || batchId,
      }),
    );

    const jobIds = await Promise.all(jobPromises);

    this.logger.log(`Added ${jobIds.length} checking jobs in batch ${batchId}`);

    return { jobIds, batchId };
  }

  /** Returns null when the job doesn't exist (or has been cleaned up). */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    userId: string;
    result?: DomainCheckingJobResult;
    error?: string;
  } | null> {
    const job = await this.checkingQueue.getJob(jobId);
    if (!job) return null;

    return {
      status: await job.getState(),
      userId: job.data.userId,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }

  async getBatchStatus(
    batchId: string,
    userId: string,
  ): Promise<{
    total: number;
    completed: number;
    failed: number;
    active: number;
    waiting: number;
    results: any[];
  }> {
    const jobs = await this.checkingQueue.getJobs([
      'completed',
      'failed',
      'active',
      'waiting',
    ]);

    const batchJobs = jobs.filter(
      (job) => job.data.parentJobId === batchId && job.data.userId === userId,
    );

    const completedJobs = batchJobs.filter(
      (job) => job.finishedOn !== undefined && job.failedReason === undefined,
    );

    const completed = completedJobs.length;
    const failed = batchJobs.filter(
      (job) => job.failedReason !== undefined,
    ).length;
    const active = batchJobs.filter(
      (job) => job.processedOn !== undefined && job.finishedOn === undefined,
    ).length;
    const waiting = batchJobs.filter(
      (job) => job.processedOn === undefined,
    ).length;

    const results: any[] = [];
    for (const job of completedJobs) {
      if (job.returnvalue && job.returnvalue.results) {
        results.push(...job.returnvalue.results);
      }
    }

    return {
      total: batchJobs.length,
      completed,
      failed,
      active,
      waiting,
      results,
    };
  }
}
