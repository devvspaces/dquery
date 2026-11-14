import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { RegistrarsService } from '../../modules/registrars/registrars.service';
import { CreditsService } from '../../modules/credits/credits.service';
import { QUEUE_NAMES } from '../constants/queue-names';
import {
  DomainCheckingJobData,
  DomainCheckingJobResult,
} from '../interfaces/job-data.interface';
import { jobQueueLogs } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { pickBestOffer } from '../../modules/registrars/aggregation';
import {
  normalizeName,
  normalizeTld,
} from '../../modules/registrars/utils/domain.util';

@Processor(QUEUE_NAMES.DOMAIN_CHECKING, {
  concurrency: 10,
  limiter: {
    max: 100,
    duration: 60000,
  },
})
export class DomainCheckingProcessor extends WorkerHost {
  private readonly logger = new Logger(DomainCheckingProcessor.name);

  constructor(
    private readonly registrarsService: RegistrarsService,
    private readonly creditsService: CreditsService,
    private readonly databaseService: DatabaseService,
  ) {
    super();
  }

  async process(
    job: Job<DomainCheckingJobData, DomainCheckingJobResult>,
  ): Promise<DomainCheckingJobResult> {
    const db = this.databaseService.getDb();
    const { domains, userId } = job.data;

    // Support both single domain and bulk domains for backwards compatibility
    const domainsToCheck = domains || [
      { domain: (job.data as any).domain, tld: (job.data as any).tld },
    ];

    this.logger.debug(
      `Processing checking job ${job.id} for ${domainsToCheck.length} domains`,
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

      // Check all domains in bulk
      const availabilityResultsMap =
        await this.registrarsService.checkDomainsBulk(domainsToCheck, userId);

      // Compile results for each domain
      const results: DomainCheckingJobResult['results'] = [];

      for (const d of domainsToCheck) {
        const domainKey = `${normalizeName(d.domain)}.${normalizeTld(d.tld)}`;
        const domainResults = availabilityResultsMap.get(domainKey) || [];

        const availableCount = domainResults.filter(
          (r) => r.status === 'available',
        ).length;
        const best = pickBestOffer(domainResults);
        const bestPrice: number | null = best?.price ?? null;
        const bestRegistrar: string | null = best?.registrar ?? null;

        results.push({
          domain: d.domain,
          tld: d.tld,
          results: domainResults,
          availableCount,
          bestPrice,
          bestRegistrar,
          checkedAt: new Date(),
        });
      }

      const result: DomainCheckingJobResult = {
        results,
        checkedAt: new Date(),
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

      this.logger.debug(
        `Completed bulk checking job ${job.id}: processed ${domainsToCheck.length} domains successfully`,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Checking job ${job.id} failed: ${errorMessage}`,
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

      // Refund credits only if completely failed
      await this.creditsService.addCredits(
        job.data.userId,
        job.data.creditsDeducted,
        'refund',
        `Checking job ${job.id} failed: ${errorMessage}`,
        {
          jobId: job.id,
          domains: domainsToCheck.map((d) => `${d.domain}.${d.tld}`),
        },
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
