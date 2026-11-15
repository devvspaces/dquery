import { Injectable, Logger } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { adminAuditLog } from '../../database/schema';

/** Append-only record of admin actions. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  async record(
    adminEmail: string,
    action: string,
    target?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .getDb()
      .insert(adminAuditLog)
      .values({
        adminEmail,
        action,
        target: target ?? null,
        details: details ?? null,
      });
    this.logger.log(`[audit] ${adminEmail} ${action} ${target ?? ''}`);
  }

  async list(page = 1, limit = 50) {
    const rows = await this.db
      .getDb()
      .select()
      .from(adminAuditLog)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
    return rows;
  }
}
