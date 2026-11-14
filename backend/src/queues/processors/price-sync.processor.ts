import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../constants/queue-names';
import { TldPricesService } from '../../modules/registrars/tld-prices.service';
import type { SyncReport } from '../../modules/registrars/tld-prices.service';

/**
 * Daily TLD price-catalog sync. Fails the job (so BullMQ retries it) only
 * when every provider failed; partial failures are logged in the result.
 */
@Processor(QUEUE_NAMES.PRICE_SYNC, { concurrency: 1 })
export class PriceSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(PriceSyncProcessor.name);

  constructor(private readonly tldPricesService: TldPricesService) {
    super();
  }

  async process(job: Job<{ registrars?: string[] }>): Promise<SyncReport[]> {
    const reports = await this.tldPricesService.syncAllPrices(
      job.data?.registrars,
    );
    const failed = reports.filter((r) => !r.ok);
    this.logger.log(
      `Price sync ${job.id}: ${reports.length - failed.length} ok, ${failed.length} failed`,
    );
    if (reports.length > 0 && failed.length === reports.length) {
      throw new Error(
        `All price syncs failed: ${failed.map((f) => `${f.registrar}: ${f.error}`).join('; ')}`,
      );
    }
    return reports;
  }
}
