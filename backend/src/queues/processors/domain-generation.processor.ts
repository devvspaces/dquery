import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { LLMService } from '../../modules/llm/llm.service';
import { CreditsService } from '../../modules/credits/credits.service';
import { DomainCheckingProducer } from '../producers/domain-checking.producer';
import { QUEUE_NAMES } from '../constants/queue-names';
import {
  DomainGenerationJobData,
  DomainGenerationJobResult,
} from '../interfaces/job-data.interface';
import { jobQueueLogs, savedSearches } from '../../database/schema';
import { eq } from 'drizzle-orm';

@Processor(QUEUE_NAMES.DOMAIN_GENERATION, {
  concurrency: 2,
  limiter: {
    max: 10,
    duration: 60000,
  },
})
export class DomainGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(DomainGenerationProcessor.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly creditsService: CreditsService,
    private readonly checkingProducer: DomainCheckingProducer,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(
    job: Job<DomainGenerationJobData, DomainGenerationJobResult>,
  ): Promise<DomainGenerationJobResult> {
    const db = this.databaseService.getDb();
    this.logger.log(
      `Processing generation job ${job.id} for user ${job.data.userId}`,
    );

    try {
      // Update job status to active
      await db
        .update(jobQueueLogs)
        .set({
          status: 'active',
          startedAt: new Date(),
        })
        .where(eq(jobQueueLogs.jobId, job.id as string));

      // Generate domains using LLM
      const generationResult = await this.llmService.generateDomains(
        {
          businessName: job.data.businessName,
          description: job.data.description,
          count: job.data.count,
          style: job.data.style,
        },
        job.data.userId,
      );

      // Save to search history
      const [searchHistoryRecord] = await db
        .insert(savedSearches)
        .values({
          userId: job.data.userId,
          businessName: job.data.businessName,
          description: job.data.description,
          tlds: JSON.stringify(job.data.tlds),
          resultsCount: generationResult.domains.length,
          createdAt: new Date(),
        })
        .returning();

      const searchHistoryId = searchHistoryRecord.id;

      // Calculate credits for domain checking
      const tlds = job.data.tlds;
      const enabledRegistrars =
        this.configService
          .get<string>('ENABLED_REGISTRARS')
          ?.split(',')
          .filter((r) => r.trim()).length || 4;

      const creditPerCheck =
        this.configService.get<number>('credits.perRegistrarQuery') || 0.05;

      // Flatten domain + TLD combinations
      const domainTldPairs: Array<{ domain: string; tld: string }> = [];
      for (const domain of generationResult.domains) {
        for (const tld of tlds) {
          domainTldPairs.push({ domain, tld });
        }
      }

      // Chunk domain+TLD combinations into batches of at most 20
      const chunkSize = 20;
      const batches: Array<Array<{ domain: string; tld: string }>> = [];
      for (let i = 0; i < domainTldPairs.length; i += chunkSize) {
        batches.push(domainTldPairs.slice(i, i + chunkSize));
      }

      // Create checking jobs for each batch
      const checkingJobPromises: Promise<string>[] = [];

      for (const batch of batches) {
        const batchCredits = batch.length * enabledRegistrars * creditPerCheck;

        checkingJobPromises.push(
          this.checkingProducer.addJob({
            userId: job.data.userId,
            domains: batch,
            creditsDeducted: batchCredits,
            parentJobId: job.id,
            searchHistoryId,
          }),
        );
      }

      const checkingJobIds = await Promise.all(checkingJobPromises);

      this.logger.log(
        `Created ${checkingJobIds.length} bulk checking jobs (total ${domainTldPairs.length} checks) for generation job ${job.id}`,
      );

      const result: DomainGenerationJobResult = {
        domains: generationResult.domains,
        tokensUsed: generationResult.tokensUsed,
        estimatedCost: generationResult.estimatedCost,
        provider: generationResult.provider,
        model: generationResult.model,
        searchHistoryId,
        checkingJobIds,
      };

      // Update job status to completed
      await db
        .update(jobQueueLogs)
        .set({
          status: 'completed',
          result: result,
          completedAt: new Date(),
        })
        .where(eq(jobQueueLogs.jobId, job.id as string));

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Generation job ${job.id} failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Update job status to failed
      await db
        .update(jobQueueLogs)
        .set({
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        })
        .where(eq(jobQueueLogs.jobId, job.id as string));

      // Refund credits
      await this.creditsService.addCredits(
        job.data.userId,
        job.data.creditsDeducted,
        'refund',
        `Generation job ${job.id} failed: ${errorMessage}`,
        { jobId: job.id },
      );

      // Update refund in logs
      await db
        .update(jobQueueLogs)
        .set({
          creditsRefunded: job.data.creditsDeducted.toString(),
        })
        .where(eq(jobQueueLogs.jobId, job.id as string));

      throw error;
    }
  }
}
