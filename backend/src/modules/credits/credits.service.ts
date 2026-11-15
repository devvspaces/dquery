import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { eq, desc, count } from 'drizzle-orm';
import { credits, creditTransactions, users } from '../../database/schema';
import { InsufficientCreditsException } from './exceptions/insufficient-credits.exception';
import {
  CreditBalanceDto,
  CreditTransactionDto,
  CreditStatsDto,
  CreditEstimateDto,
  CreditEstimateRequestDto,
} from './dto';
import { CreditPricingService } from './credit-pricing.service';
import { SettingsService } from '../settings/settings.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private databaseService: DatabaseService,
    private configService: ConfigService,
    private pricingService: CreditPricingService,
    private settings: SettingsService,
  ) {}

  /**
   * Get user's current credit balance
   */
  async getBalance(userId: string): Promise<CreditBalanceDto> {
    const db = this.databaseService.getDb();

    const result = await db
      .select()
      .from(credits)
      .where(eq(credits.userId, userId))
      .limit(1);

    if (!result.length) {
      // This shouldn't happen as credits are created during user registration
      this.logger.warn(`No credit record found for user ${userId}`);
      return new CreditBalanceDto(0, 0, 0);
    }

    const creditRecord = result[0];
    return new CreditBalanceDto(
      parseFloat(creditRecord.balance),
      parseFloat(creditRecord.totalPurchased),
      parseFloat(creditRecord.totalUsed),
    );
  }

  /**
   * Check if user has sufficient credits
   */
  async checkSufficientCredits(
    userId: string,
    requiredAmount: number,
  ): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance.balance >= requiredAmount;
  }

  /**
   * Deduct credits from user's balance
   * Uses database transaction for atomicity
   */
  async deductCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: any,
    idempotencyKey?: string,
  ): Promise<number> {
    const db = this.databaseService.getDb();

    try {
      const newBalance = await db.transaction(async (tx) => {
        // 1. Get current balance with row lock to prevent race conditions
        const [creditRecord] = await tx
          .select()
          .from(credits)
          .where(eq(credits.userId, userId))
          .for('update');

        if (!creditRecord) {
          throw new Error(`No credit record found for user ${userId}`);
        }

        const currentBalance = parseFloat(creditRecord.balance);

        // 2. Validate sufficient balance
        if (currentBalance < amount) {
          throw new InsufficientCreditsException(amount, currentBalance);
        }

        // 3. Calculate new balance
        const newBalance = currentBalance - amount;
        const newTotalUsed = parseFloat(creditRecord.totalUsed) + amount;

        // 4. Update credits table
        await tx
          .update(credits)
          .set({
            balance: newBalance.toFixed(2),
            totalUsed: newTotalUsed.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(credits.userId, userId));

        // 5. Log transaction
        await tx.insert(creditTransactions).values({
          userId,
          amount: amount.toFixed(2),
          type: 'deduction',
          description,
          balanceBefore: creditRecord.balance,
          balanceAfter: newBalance.toFixed(2),
          metadata: metadata ? JSON.stringify(metadata) : null,
          idempotencyKey: idempotencyKey ?? null,
        });

        this.logger.log(
          `Deducted ${amount} credits from user ${userId}. New balance: ${newBalance}`,
        );

        return newBalance;
      });

      return newBalance;
    } catch (error) {
      if (error instanceof InsufficientCreditsException) {
        throw error;
      }
      this.logger.error(
        `Failed to deduct credits for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Add credits to user's balance
   * Used for purchases, refunds, and bonuses
   */
  async addCredits(
    userId: string,
    amount: number,
    type: 'purchase' | 'refund' | 'bonus',
    description: string,
    metadata?: any,
    options: { idempotencyKey?: string } = {},
  ): Promise<number> {
    const db = this.databaseService.getDb();
    const { idempotencyKey } = options;

    try {
      const newBalance = await db.transaction(async (tx) => {
        // 1. Get current balance with row lock
        const [creditRecord] = await tx
          .select()
          .from(credits)
          .where(eq(credits.userId, userId))
          .for('update');

        if (!creditRecord) {
          throw new Error(`No credit record found for user ${userId}`);
        }

        const currentBalance = parseFloat(creditRecord.balance);

        // Already applied (e.g. a retried refund or a replayed webhook): no-op.
        // Checked under the row lock, and backed by a unique index.
        if (idempotencyKey) {
          const [existing] = await tx
            .select({ id: creditTransactions.id })
            .from(creditTransactions)
            .where(eq(creditTransactions.idempotencyKey, idempotencyKey))
            .limit(1);
          if (existing) {
            this.logger.warn(
              `Skipping duplicate credit operation ${idempotencyKey} for user ${userId}`,
            );
            return currentBalance;
          }
        }

        // 2. Calculate new balance
        const newBalance = currentBalance + amount;
        const newTotalPurchased =
          type === 'purchase'
            ? parseFloat(creditRecord.totalPurchased) + amount
            : parseFloat(creditRecord.totalPurchased);

        // 3. Update credits table
        await tx
          .update(credits)
          .set({
            balance: newBalance.toFixed(2),
            totalPurchased: newTotalPurchased.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(credits.userId, userId));

        // 4. Log transaction
        await tx.insert(creditTransactions).values({
          userId,
          amount: amount.toFixed(2),
          type,
          description,
          balanceBefore: creditRecord.balance,
          balanceAfter: newBalance.toFixed(2),
          metadata: metadata ? JSON.stringify(metadata) : null,
          idempotencyKey: idempotencyKey ?? null,
        });

        this.logger.log(
          `Added ${amount} credits to user ${userId} (${type}). New balance: ${newBalance}`,
        );

        return newBalance;
      });

      return newBalance;
    } catch (error) {
      this.logger.error(
        `Failed to add credits for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get user's transaction history with pagination
   */
  async getTransactionHistory(
    userId: string,
    pagination: PaginationDto,
  ): Promise<{ data: CreditTransactionDto[]; total: number }> {
    const db = this.databaseService.getDb();
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    // Get transactions
    const transactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));

    return {
      data: transactions.map((t) => new CreditTransactionDto(t)),
      total: totalResult.length,
    };
  }

  /**
   * Get credit statistics for user
   */
  async getCreditStats(userId: string): Promise<CreditStatsDto> {
    const balance = await this.getBalance(userId);

    // Calculate total earned (initial free + bonuses)
    const db = this.databaseService.getDb();
    const bonusTransactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));

    const totalEarned = bonusTransactions
      .filter((t) => t.type === 'bonus')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return new CreditStatsDto(
      balance.balance,
      balance.totalPurchased,
      balance.totalUsed,
      totalEarned,
    );
  }

  /**
   * Admin credit adjustment: positive grants (bonus), negative removes
   * (deduction). Keyed by `requestId` so a retried request applies once.
   */
  async adjust(
    userId: string,
    delta: number,
    reason: string,
    adminEmail: string,
    requestId: string,
  ): Promise<number> {
    const metadata = { source: 'admin', admin: adminEmail, reason };
    const key = `admin:${requestId}`;
    const description = `Admin adjustment: ${reason}`;
    if (delta > 0) {
      return this.addCredits(userId, delta, 'bonus', description, metadata, {
        idempotencyKey: key,
      });
    }
    const db = this.databaseService.getDb();
    const [done] = await db
      .select({ id: creditTransactions.id })
      .from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, key))
      .limit(1);
    if (done) return (await this.getBalance(userId)).balance;
    return this.deductCredits(userId, -delta, description, metadata, key);
  }

  /**
   * Estimate the credit cost of an operation, using the same prices that are charged.
   */
  estimateCost(dto: CreditEstimateRequestDto): CreditEstimateDto {
    const quote =
      dto.operation === 'check'
        ? this.pricingService.quoteChecks(dto.names ?? 1)
        : this.pricingService.quoteGeneration(
            dto.engine ?? 'ai',
            dto.names ?? 15,
            dto.tlds ?? 1,
          );
    return new CreditEstimateDto(dto.operation, quote);
  }

  /**
   * How many free credits a new user gets, given how many users existed before them.
   */
  signupGrantAmount(existingUsers: number): number {
    const early = this.settings.get<number>('credits.freeEarly');
    const limit = this.settings.get<number>('credits.freeEarlyLimit');
    const fallback = this.settings.get<number>('credits.freeDefault');
    return existingUsers < limit ? early : fallback;
  }

  /** Public promo info for the sign-in dialog. */
  async getPromo(): Promise<{
    earlyAmount: number;
    earlyLimit: number;
    earlyRemaining: number;
    defaultAmount: number;
  }> {
    const db = this.databaseService.getDb();
    const [{ value }] = await db.select({ value: count() }).from(users);
    const earlyLimit = this.settings.get<number>('credits.freeEarlyLimit');
    return {
      earlyAmount: this.settings.get<number>('credits.freeEarly'),
      earlyLimit,
      earlyRemaining: Math.max(0, earlyLimit - Number(value)),
      defaultAmount: this.settings.get<number>('credits.freeDefault'),
    };
  }
}
