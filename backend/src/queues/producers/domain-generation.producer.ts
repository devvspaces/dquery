import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { QUEUE_NAMES } from '../constants/queue-names';
import {
  DomainGenerationJobData,
  DomainGenerationJobResult,
} from '../interfaces/job-data.interface';
import { jobQueueLogs } from '../../database/schema';

@Injectable()
export class DomainGenerationProducer {
  private readonly logger = new Logger(DomainGenerationProducer.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.DOMAIN_GENERATION)
    private readonly generationQueue: Queue<
      DomainGenerationJobData,
      DomainGenerationJobResult
    >,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async addJob(data: DomainGenerationJobData): Promise<string> {
    const db = this.databaseService.getDb();

    const job = await this.generationQueue.add('generate-domains', data, {
      attempts:
        this.configService.get<number>('queue.generation.attempts') || 2,
      backoff: this.configService.get('queue.generation.backoff') || {
        type: 'exponential',
        delay: 10000,
      },
      removeOnComplete: this.configService.get('queue.removeOnComplete') || {
        age: 3600,
        count: 1000,
      },
      removeOnFail: this.configService.get('queue.removeOnFail') || {
        age: 86400,
      },
    });

    // Log job creation to database
    try {
      await db.insert(jobQueueLogs).values({
        jobId: job.id as string,
        userId: data.userId,
        queueName: QUEUE_NAMES.DOMAIN_GENERATION,
        jobType: 'generate-domains',
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

    this.logger.log(`Added generation job ${job.id} for user ${data.userId}`);
    return job.id as string;
  }

  /** Returns null when the job doesn't exist (or has been cleaned up). */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    userId: string;
    result?: DomainGenerationJobResult;
    error?: string;
  } | null> {
    const job = await this.generationQueue.getJob(jobId);
    if (!job) return null;

    return {
      status: await job.getState(),
      userId: job.data.userId,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }
}
