import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { SettingsService } from '../../modules/settings/settings.service';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../constants/queue-names';

/**
 * Registers the repeatable price-sync job (idempotent across restarts and
 * multiple instances, unlike the old sync-on-boot).
 * Schedule: the prices.syncCron setting (default PRICE_SYNC_CRON, 03:15 UTC).
 */
@Injectable()
export class PriceSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(PriceSyncScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.PRICE_SYNC) private readonly queue: Queue,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Tests must not register a cron in a (possibly shared) Redis.
    if (process.env.NODE_ENV === 'test') return;
    await this.reschedule(this.settings.get<string>('prices.syncCron'));
    // Changing the schedule in the admin panel re-registers it immediately.
    this.settings.onChange('prices.syncCron', (pattern) =>
      this.reschedule(pattern as string),
    );
  }

  /** (Re)register the daily sync with a cron pattern (UTC). Idempotent. */
  async reschedule(pattern: string): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        'daily-tld-price-sync',
        { pattern, tz: 'UTC' },
        {
          name: 'sync-all',
          data: {},
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 60_000 },
            removeOnComplete: { count: 30 },
            removeOnFail: { count: 30 },
          },
        },
      );
      this.logger.log(`Price sync scheduled (${pattern} UTC)`);
    } catch (error) {
      this.logger.error(
        `Could not schedule price sync: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /** Run a sync now (e.g. from an admin endpoint). */
  async runNow(registrars?: string[]): Promise<string | undefined> {
    const job = await this.queue.add('sync-now', { registrars });
    return job.id;
  }
}
