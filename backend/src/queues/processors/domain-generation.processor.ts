import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { LLMService } from '../../modules/llm/llm.service';
import { NamegenService } from '../../modules/namegen/namegen.service';
import { CreditsService } from '../../modules/credits/credits.service';
import { CreditPricingService } from '../../modules/credits/credit-pricing.service';
import { isFinalAttempt } from '../utils/attempts';
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
    private readonly namegen: NamegenService,
    private readonly creditsService: CreditsService,
    private readonly checkingProducer: DomainCheckingProducer,
    private readonly databaseService: DatabaseService,
    private readonly pricing: CreditPricingService,
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

    // Once checking jobs exist they refund their own share if they fail.
    let checkingQueued = false;

    try {
      // Update job status to active
      await db
        .update(jobQueueLogs)
        .set({
          status: 'active',
          startedAt: new Date(),
        })
        .where(eq(jobQueueLogs.jobId, job.id as string));

      const generationResult = await this.generate(job.data);

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

      const tlds = job.data.tlds;

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
        // Bookkeeping only: the whole search was charged up front.
        const batchCredits = this.pricing.quoteChecks(batch.length).total;

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
      checkingQueued = true;

      this.logger.log(
        `Created ${checkingJobIds.length} bulk checking jobs (total ${domainTldPairs.length} checks) for generation job ${job.id}`,
      );

      const result: DomainGenerationJobResult = {
        domains: generationResult.domains,
        tokensUsed: generationResult.tokensUsed,
        estimatedCost: generationResult.estimatedCost,
        provider: generationResult.provider,
        model: generationResult.model,
        techniques: generationResult.techniques,
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

      // Refund once, and only when no retry is left.
      if (isFinalAttempt(job)) {
        const refund = checkingQueued
          ? this.pricing.quoteGeneration(job.data.engine ?? 'ai', 0, 0)
              .generation
          : job.data.creditsDeducted;
        await this.creditsService.addCredits(
          job.data.userId,
          refund,
          'refund',
          `Generation job ${job.id} failed: ${errorMessage}`,
          { jobId: job.id },
          { idempotencyKey: `refund:generation:${job.id}` },
        );

        await db
          .update(jobQueueLogs)
          .set({ creditsRefunded: refund.toString() })
          .where(eq(jobQueueLogs.jobId, job.id as string));
      }

      throw error;
    }
  }

  /** Names from the LLM or the rule-based word engine, in the same shape. */
  private async generate(data: DomainGenerationJobData): Promise<{
    domains: string[];
    tokensUsed: DomainGenerationJobResult['tokensUsed'];
    estimatedCost: number;
    provider: string;
    model: string;
    techniques?: Record<string, string>;
  }> {
    if (data.engine === 'words') {
      const names = this.namegen.generate({
        seeds: [],
        ...data.wordEngine,
        count: data.count,
      });
      return {
        domains: names.map((n) => n.name),
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        estimatedCost: 0,
        provider: 'word-engine',
        model: 'rules-v1',
        techniques: Object.fromEntries(names.map((n) => [n.name, n.technique])),
      };
    }
    return this.llmService.generateDomains(
      {
        businessName: data.businessName,
        description: data.description,
        count: data.count,
        style: data.style,
      },
      data.userId,
    );
  }
}
