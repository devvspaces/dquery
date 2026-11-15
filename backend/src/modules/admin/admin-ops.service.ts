import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { QUEUE_NAMES } from '../../queues/constants/queue-names';
import { PriceSyncScheduler } from '../../queues/producers/price-sync.scheduler';
import { RegistrarsService } from '../registrars/registrars.service';
import { TldPricesService } from '../registrars/tld-prices.service';
import { AuditService } from '../settings/audit.service';

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
type Row = Record<string, unknown>;

/** Registrar health, prices, queues and payments for the admin panel. */
@Injectable()
export class AdminOpsService {
  private readonly queues: Record<string, Queue>;

  constructor(
    private readonly db: DatabaseService,
    private readonly registrars: RegistrarsService,
    private readonly tldPrices: TldPricesService,
    private readonly scheduler: PriceSyncScheduler,
    private readonly audit: AuditService,
    @InjectQueue(QUEUE_NAMES.DOMAIN_GENERATION) generation: Queue,
    @InjectQueue(QUEUE_NAMES.DOMAIN_CHECKING) checking: Queue,
    @InjectQueue(QUEUE_NAMES.PRICE_SYNC) priceSync: Queue,
  ) {
    this.queues = {
      [QUEUE_NAMES.DOMAIN_GENERATION]: generation,
      [QUEUE_NAMES.DOMAIN_CHECKING]: checking,
      [QUEUE_NAMES.PRICE_SYNC]: priceSync,
    };
  }

  private rows(query: ReturnType<typeof sql>): Promise<Row[]> {
    return this.db.getDb().execute(query);
  }

  // --- Registrars ------------------------------------------------------------

  async registrarHealth() {
    const providers = this.registrars.describeProviders();
    const [catalog, lastRuns, api] = await Promise.all([
      this.rows(sql`
        select registrar, count(*) as tlds, max(updated_at) as updated_at,
          count(*) filter (where source = 'manual') as manual
        from tld_prices group by registrar`),
      this.rows(sql`
        select distinct on (registrar) registrar, ok, count, error, started_at, duration_ms
        from price_sync_runs order by registrar, started_at desc`),
      this.rows(sql`
        select registrar, count(*) as calls,
          avg(case when success then 1 else 0 end) as success_rate,
          percentile_cont(0.5) within group (order by response_time) as p50,
          percentile_cont(0.95) within group (order by response_time) as p95
        from registrar_api_logs
        where created_at > now() - interval '24 hours' and response_time is not null
        group by registrar`),
    ]);
    const byId = (rows: Row[]) =>
      new Map(rows.map((r) => [String(r.registrar), r]));
    const cat = byId(catalog);
    const runs = byId(lastRuns);
    const calls = byId(api); // keyed by display name
    return providers.map((p) => {
      const c = cat.get(p.id);
      const run = runs.get(p.id);
      const a = calls.get(p.name);
      return {
        ...p,
        tldCount: n(c?.tlds),
        manualPrices: n(c?.manual),
        pricesUpdatedAt: c?.updated_at ?? null,
        lastSync: run
          ? {
              ok: run.ok as boolean,
              count: n(run.count),
              error: (run.error as string | null) ?? null,
              startedAt: run.started_at,
              durationMs: n(run.duration_ms),
            }
          : null,
        api24h: a
          ? {
              calls: n(a.calls),
              successRate: Math.round(n(a.success_rate) * 1000) / 10,
              p50Ms: Math.round(n(a.p50)),
              p95Ms: Math.round(n(a.p95)),
            }
          : null,
      };
    });
  }

  async syncRuns(limit = 100) {
    return this.rows(sql`
      select id, registrar, ok, count, error, started_at as "startedAt", duration_ms as "durationMs"
      from price_sync_runs order by started_at desc limit ${limit}`);
  }

  async runSync(registrars: string[] | undefined, adminEmail: string) {
    const jobId = await this.scheduler.runNow(
      registrars?.length ? registrars : undefined,
    );
    await this.audit.record(
      adminEmail,
      'prices.sync',
      registrars?.join(',') || 'all',
      { jobId },
    );
    return { jobId };
  }

  // --- Prices ----------------------------------------------------------------

  async listPrices(filter: {
    tld?: string;
    registrar?: string;
    source?: string;
    page: number;
    limit: number;
  }) {
    const conds = [sql`true`];
    if (filter.tld)
      conds.push(sql`tld = ${filter.tld.toLowerCase().replace(/^\./, '')}`);
    if (filter.registrar)
      conds.push(sql`registrar = ${filter.registrar.toLowerCase()}`);
    if (filter.source) conds.push(sql`source = ${filter.source}`);
    const where = sql.join(conds, sql` and `);
    const rows = await this.rows(sql`
      select registrar, tld, register_price, renewal_price, transfer_price, is_promo,
        source, currency, updated_at, count(*) over () as total
      from tld_prices where ${where}
      order by tld, register_price
      limit ${filter.limit} offset ${(filter.page - 1) * filter.limit}`);
    return {
      total: rows.length ? n(rows[0].total) : 0,
      page: filter.page,
      limit: filter.limit,
      data: rows.map((r) => ({
        registrar: r.registrar as string,
        tld: r.tld as string,
        registerPrice: n(r.register_price),
        renewalPrice: n(r.renewal_price),
        transferPrice: r.transfer_price === null ? null : n(r.transfer_price),
        isPromo: r.is_promo as boolean,
        source: r.source as string,
        currency: r.currency as string,
        updatedAt: r.updated_at,
      })),
    };
  }

  async setManualPrice(
    p: {
      registrar: string;
      tld: string;
      register: number;
      renew: number;
      currency: string;
    },
    adminEmail: string,
  ) {
    await this.tldPrices.setTldPrice(
      p.registrar,
      p.tld,
      p.register,
      p.renew,
      p.currency,
    );
    await this.audit.record(
      adminEmail,
      'prices.set',
      `${p.registrar}/${p.tld}`,
      p,
    );
    return { ok: true };
  }

  async deleteManualPrice(registrar: string, tld: string, adminEmail: string) {
    const deleted = await this.tldPrices.deleteManualPrice(registrar, tld);
    if (!deleted)
      throw new NotFoundException('No manual price for that registrar and TLD');
    await this.audit.record(adminEmail, 'prices.delete', `${registrar}/${tld}`);
    return { ok: true };
  }

  async fxRates() {
    return this.rows(sql`
      select currency, per_usd::float as "perUsd", updated_at as "updatedAt"
      from fx_rates order by currency`);
  }

  // --- Queues & payments ----------------------------------------------------------

  async queueStatus() {
    const counts = await Promise.all(
      Object.entries(this.queues).map(async ([name, q]) => ({
        name,
        counts: await q.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        ),
      })),
    );
    const recentFailures = await this.rows(sql`
      select job_id as "jobId", queue_name as "queue", job_type as "jobType", user_id as "userId",
        error, credits_deducted as "creditsDeducted", credits_refunded as "creditsRefunded",
        created_at as "createdAt"
      from job_queue_logs where status = 'failed'
      order by created_at desc limit 50`);
    return { queues: counts, recentFailures };
  }

  async retryJob(queue: string, jobId: string, adminEmail: string) {
    const q = this.queues[queue];
    if (!q) throw new NotFoundException(`Unknown queue ${queue}`);
    const job = await q.getJob(jobId);
    if (!job)
      throw new NotFoundException(
        'Job not found (it may have been cleaned up)',
      );
    await job.retry('failed');
    await this.audit.record(adminEmail, 'queue.retry', `${queue}/${jobId}`);
    return { ok: true };
  }

  async payments(status: string | undefined, page: number, limit: number) {
    const where = status ? sql`where p.status = ${status}` : sql``;
    const rows = await this.rows(sql`
      select p.id, p.user_id as "userId", u.email, p.provider, p.provider_reference as "reference",
        p.pack_id as "packId", p.amount, p.currency, p.amount_usd as "amountUsd",
        p.credits_purchased as "credits", p.status, p.created_at as "createdAt",
        p.completed_at as "completedAt", count(*) over () as total
      from purchases p left join users u on u.id = p.user_id
      ${where}
      order by p.created_at desc
      limit ${limit} offset ${(page - 1) * limit}`);
    return {
      total: rows.length ? n(rows[0].total) : 0,
      page,
      limit,
      data: rows.map((row) => {
        const r = { ...row };
        delete r.total;
        return {
          ...r,
          amount: r.amount === null ? null : n(r.amount),
          amountUsd: n(r.amountUsd),
          credits: n(r.credits),
        };
      }),
    };
  }
}
