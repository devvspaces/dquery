import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  creditTransactions,
  credits,
  jobQueueLogs,
  purchases,
  savedSearches,
  users,
} from '../../database/schema';
import { CreditsService } from '../credits/credits.service';
import { AuditService } from '../settings/audit.service';
import { isAdminEmail } from '../../common/admin-access';

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly credits: CreditsService,
    private readonly audit: AuditService,
  ) {}

  /** Users matching `q` (email or name), newest first, with balance and activity. */
  async list(q: string | undefined, page: number, limit: number) {
    const term = q?.trim() ? `%${q.trim().toLowerCase()}%` : null;
    const where = term
      ? sql`where lower(u.email) like ${term} or lower(u.name) like ${term}`
      : sql``;
    const rows = (await this.db.getDb().execute(sql`
      select u.id, u.email, u.name, u.avatar, u.provider, u.created_at, u.suspended_at,
        coalesce(c.balance, 0) as balance, coalesce(c.total_purchased, 0) as total_purchased,
        coalesce(c.total_used, 0) as total_used,
        (select max(t.created_at) from credit_transactions t where t.user_id = u.id) as last_activity,
        count(*) over () as total
      from users u
      left join credits c on c.user_id = u.id
      ${where}
      order by u.created_at desc
      limit ${limit} offset ${(page - 1) * limit}
    `)) as unknown as Record<string, unknown>[];
    return {
      total: rows.length ? n(rows[0].total) : 0,
      page,
      limit,
      data: rows.map((r) => ({
        id: r.id as string,
        email: r.email as string,
        name: r.name as string,
        avatar: r.avatar as string | null,
        provider: r.provider as string,
        createdAt: r.created_at,
        suspendedAt: r.suspended_at,
        balance: n(r.balance),
        totalPurchased: n(r.total_purchased),
        totalUsed: n(r.total_used),
        lastActivity: r.last_activity,
        isAdmin: isAdminEmail(r.email as string),
      })),
    };
  }

  async detail(id: string) {
    const db = this.db.getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    const [wallet] = await db
      .select()
      .from(credits)
      .where(eq(credits.userId, id));
    const [ledger, searches, jobs, payments] = await Promise.all([
      db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, id))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(50),
      db
        .select()
        .from(savedSearches)
        .where(eq(savedSearches.userId, id))
        .orderBy(desc(savedSearches.createdAt))
        .limit(30),
      db
        .select({
          jobId: jobQueueLogs.jobId,
          jobType: jobQueueLogs.jobType,
          status: jobQueueLogs.status,
          error: jobQueueLogs.error,
          creditsDeducted: jobQueueLogs.creditsDeducted,
          creditsRefunded: jobQueueLogs.creditsRefunded,
          createdAt: jobQueueLogs.createdAt,
        })
        .from(jobQueueLogs)
        .where(
          and(
            eq(jobQueueLogs.userId, id),
            eq(jobQueueLogs.jobType, 'generate-domains'),
          ),
        )
        .orderBy(desc(jobQueueLogs.createdAt))
        .limit(30),
      db
        .select()
        .from(purchases)
        .where(eq(purchases.userId, id))
        .orderBy(desc(purchases.createdAt))
        .limit(30),
    ]);
    return {
      user: { ...user, isAdmin: isAdminEmail(user.email) },
      wallet: {
        balance: n(wallet?.balance),
        totalPurchased: n(wallet?.totalPurchased),
        totalUsed: n(wallet?.totalUsed),
      },
      ledger: ledger.map((t) => ({
        ...t,
        amount: n(t.amount),
        balanceBefore: n(t.balanceBefore),
        balanceAfter: n(t.balanceAfter),
        metadata: t.metadata ? safeJson(t.metadata) : null,
      })),
      searches,
      generationJobs: jobs,
      purchases: payments,
    };
  }

  async adjustCredits(
    id: string,
    delta: number,
    reason: string,
    requestId: string,
    adminEmail: string,
  ) {
    if (!Number.isFinite(delta) || delta === 0) {
      throw new BadRequestException('Amount must be a non-zero number');
    }
    await this.ensureUser(id);
    const balance = await this.credits.adjust(
      id,
      delta,
      reason,
      adminEmail,
      requestId,
    );
    await this.audit.record(adminEmail, 'credits.adjust', id, {
      delta,
      reason,
      requestId,
      balance,
    });
    return { balance };
  }

  async setSuspended(
    id: string,
    suspended: boolean,
    adminEmail: string,
    reason?: string,
  ) {
    const user = await this.ensureUser(id);
    if (suspended && isAdminEmail(user.email)) {
      throw new BadRequestException('Admins cannot be suspended');
    }
    await this.db
      .getDb()
      .update(users)
      .set({
        suspendedAt: suspended ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    await this.audit.record(
      adminEmail,
      suspended ? 'user.suspend' : 'user.unsuspend',
      id,
      {
        email: user.email,
        reason,
      },
    );
    return { suspended };
  }

  private async ensureUser(id: string) {
    const [user] = await this.db
      .getDb()
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
