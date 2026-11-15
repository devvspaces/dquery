import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';

export interface DailyPoint {
  day: string;
  signups: number;
  aiSearches: number;
  wordSearches: number;
  checkSearches: number;
  creditsSpent: number;
  creditsRefunded: number;
  creditsGranted: number;
  revenueUsd: number;
  purchases: number;
  aiCostUsd: number;
  activeUsers: number;
}

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** Business metrics for the admin dashboard, computed straight from the tables. */
@Injectable()
export class AdminMetricsService {
  constructor(private readonly db: DatabaseService) {}

  private rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
    return this.db.getDb().execute(query) as unknown as Promise<T[]>;
  }

  async summary(days: number) {
    const span = Math.min(365, Math.max(1, Math.floor(days)));
    const series = await this.rows<Record<string, unknown>>(sql`
      with days as (
        select generate_series(
          date_trunc('day', now()) - (${span - 1} * interval '1 day'),
          date_trunc('day', now()),
          interval '1 day'
        ) as day
      ),
      signups as (
        select date_trunc('day', created_at) as day, count(*) as n
        from users group by 1
      ),
      searches as (
        select date_trunc('day', created_at) as day,
          count(*) filter (where job_type = 'generate-domains' and coalesce(data->>'engine', 'ai') = 'ai') as ai,
          count(*) filter (where job_type = 'generate-domains' and data->>'engine' = 'words') as words,
          count(distinct coalesce(data->>'parentJobId', job_id)) filter (
            where job_type = 'check-domain'
              and (data->>'parentJobId' is null or data->>'parentJobId' like 'batch-%')
          ) as checks
        from job_queue_logs group by 1
      ),
      ledger as (
        select date_trunc('day', created_at) as day,
          sum(amount) filter (where type = 'deduction') as spent,
          sum(amount) filter (where type = 'refund') as refunded,
          sum(amount) filter (where type = 'bonus') as granted,
          count(distinct user_id) filter (where type = 'deduction') as active
        from credit_transactions group by 1
      ),
      revenue as (
        select date_trunc('day', coalesce(completed_at, created_at)) as day,
          sum(amount_usd) as usd, count(*) as n
        from purchases where status = 'completed' group by 1
      ),
      ai as (
        select date_trunc('day', created_at) as day, sum(estimated_cost) / 100.0 as usd
        from llm_usage_logs group by 1
      )
      select to_char(d.day, 'YYYY-MM-DD') as day,
        s.n as signups, q.ai, q.words, q.checks,
        l.spent, l.refunded, l.granted, l.active,
        r.usd as revenue, r.n as purchases, a.usd as ai_cost
      from days d
      left join signups s on s.day = d.day
      left join searches q on q.day = d.day
      left join ledger l on l.day = d.day
      left join revenue r on r.day = d.day
      left join ai a on a.day = d.day
      order by d.day
    `);

    const points: DailyPoint[] = series.map((r) => ({
      day: String(r.day),
      signups: n(r.signups),
      aiSearches: n(r.ai),
      wordSearches: n(r.words),
      checkSearches: n(r.checks),
      creditsSpent: n(r.spent),
      creditsRefunded: n(r.refunded),
      creditsGranted: n(r.granted),
      revenueUsd: n(r.revenue),
      purchases: n(r.purchases),
      aiCostUsd: Math.round(n(r.ai_cost) * 100) / 100,
      activeUsers: n(r.active),
    }));

    const [totals] = await this.rows<Record<string, unknown>>(sql`
      select
        (select count(*) from users) as users,
        (select count(*) from users where suspended_at is not null) as suspended,
        (select count(distinct user_id) from purchases where status = 'completed') as paying,
        (select coalesce(sum(amount_usd), 0) from purchases where status = 'completed') as revenue,
        (select coalesce(sum(estimated_cost), 0) / 100.0 from llm_usage_logs) as ai_cost,
        (select coalesce(sum(balance), 0) from credits) as outstanding_credits,
        (select count(*) from job_queue_logs where status = 'failed' and created_at > now() - interval '24 hours') as failed_jobs_24h
    `);
    const users = n(totals.users);
    const paying = n(totals.paying);

    return {
      days: span,
      series: points,
      today: points[points.length - 1],
      yesterday: points[points.length - 2] ?? null,
      totals: {
        users,
        suspendedUsers: n(totals.suspended),
        payingUsers: paying,
        conversionRate: users ? Math.round((paying / users) * 10000) / 100 : 0,
        revenueUsd: n(totals.revenue),
        aiCostUsd: Math.round(n(totals.ai_cost) * 100) / 100,
        outstandingCredits: n(totals.outstanding_credits),
        failedJobs24h: n(totals.failed_jobs_24h),
      },
    };
  }

  /** AI usage by provider and model over the last `days`. */
  async llmUsage(days: number) {
    const span = Math.min(365, Math.max(1, Math.floor(days)));
    const rows = await this.rows<Record<string, unknown>>(sql`
      select provider, model, count(*) as calls,
        coalesce(sum(total_tokens), 0) as tokens,
        coalesce(sum(estimated_cost), 0) / 100.0 as cost
      from llm_usage_logs
      where created_at > now() - (${span} * interval '1 day')
      group by provider, model
      order by cost desc
    `);
    return rows.map((r) => ({
      provider: String(r.provider),
      model: String(r.model),
      calls: n(r.calls),
      tokens: n(r.tokens),
      costUsd: Math.round(n(r.cost) * 100) / 100,
    }));
  }
}
