import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../credits/credits.service';
import { DomainGenerationProducer } from '../../queues/producers/domain-generation.producer';
import { DomainCheckingProducer } from '../../queues/producers/domain-checking.producer';
import { GenerateDomainsDto } from './dto/generate-domains.dto';
import { JobStatusDto, BatchStatusDto } from './dto/job-status.dto';
import { InsufficientCreditsException } from '../credits/exceptions/insufficient-credits.exception';
import {
  CheckDomainDto,
  BulkCheckDomainsDto,
} from '../registrars/dto/check-domain.dto';
import { DatabaseService } from '../../database/database.service';
import { bookmarks, savedSearches } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly creditsService: CreditsService,
    private readonly generationProducer: DomainGenerationProducer,
    private readonly checkingProducer: DomainCheckingProducer,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Generate domains with automatic availability checking
   */
  async generateDomains(
    dto: GenerateDomainsDto,
    userId: string,
  ): Promise<{ jobId: string; creditsDeducted: number }> {
    // Calculate total credits needed
    const generationCredits =
      this.configService.get<number>('credits.perGeneration') || 2;

    const enabledRegistrars =
      this.configService
        .get<string>('ENABLED_REGISTRARS')
        ?.split(',')
        .filter((r) => r.trim()).length || 4;

    const creditPerCheck =
      this.configService.get<number>('credits.perRegistrarQuery') || 0.05;

    // Total checking credits: domains × TLDs × registrars × credit per check
    const checkingCredits =
      dto.count * dto.tlds.length * enabledRegistrars * creditPerCheck;

    const totalCredits = generationCredits + checkingCredits;

    this.logger.log(
      `Credit calculation: Generation=${generationCredits}, Checking=${checkingCredits.toFixed(2)}, Total=${totalCredits.toFixed(2)}`,
    );

    // Check if user has sufficient credits
    const balance = await this.creditsService.getBalance(userId);
    if (balance.balance < totalCredits) {
      throw new InsufficientCreditsException(totalCredits, balance.balance);
    }

    // Deduct credits upfront
    await this.creditsService.deductCredits(
      userId,
      totalCredits,
      `Domain generation (${dto.count} domains) with availability checking (${dto.tlds.length} TLDs)`,
      {
        businessName: dto.businessName,
        count: dto.count,
        tlds: dto.tlds,
        style: dto.style,
      },
    );

    // Create generation job
    const jobId = await this.generationProducer.addJob({
      userId,
      businessName: dto.businessName,
      description: dto.description,
      count: dto.count,
      style: dto.style,
      tlds: dto.tlds,
      creditsDeducted: totalCredits,
    });

    this.logger.log(
      `Created generation job ${jobId} for user ${userId}, deducted ${totalCredits.toFixed(2)} credits`,
    );

    return {
      jobId,
      creditsDeducted: totalCredits,
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatusDto> {
    // Try generation queue first
    try {
      const genStatus = await this.generationProducer.getJobStatus(jobId);
      return {
        jobId,
        status: genStatus.status as any,
        result: genStatus.result,
        error: genStatus.error,
        createdAt: new Date(), // We'll enhance this with DB lookup if needed
      };
    } catch {
      // Try checking queue
      const checkStatus = await this.checkingProducer.getJobStatus(jobId);
      return {
        jobId,
        status: checkStatus.status as any,
        result: checkStatus.result,
        error: checkStatus.error,
        createdAt: new Date(),
      };
    }
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<BatchStatusDto> {
    const batchStatus = await this.checkingProducer.getBatchStatus(batchId);

    const progress =
      batchStatus.total > 0
        ? Math.round(
            ((batchStatus.completed + batchStatus.failed) / batchStatus.total) *
              100,
          )
        : 0;

    return {
      batchId,
      ...batchStatus,
      progress,
    };
  }

  /**
   * Check single domain availability asynchronously via queue
   */
  async checkDomainAvailability(
    dto: CheckDomainDto,
    userId: string,
  ): Promise<{ jobId: string; creditsDeducted: number }> {
    const enabledRegistrars =
      this.configService
        .get<string>('ENABLED_REGISTRARS')
        ?.split(',')
        .filter((r) => r.trim()).length || 4;

    const creditPerCheck =
      this.configService.get<number>('credits.perRegistrarQuery') || 0.05;

    const totalCredits = enabledRegistrars * creditPerCheck;

    const balance = await this.creditsService.getBalance(userId);
    if (balance.balance < totalCredits) {
      throw new InsufficientCreditsException(totalCredits, balance.balance);
    }

    await this.creditsService.deductCredits(
      userId,
      totalCredits,
      `Domain check: ${dto.domain}.${dto.tld}`,
      { domain: dto.domain, tld: dto.tld },
    );

    const jobId = await this.checkingProducer.addJob({
      userId,
      domains: [{ domain: dto.domain, tld: dto.tld }],
      creditsDeducted: totalCredits,
    });

    this.logger.log(
      `Created domain check job ${jobId} for user ${userId}, deducted ${totalCredits.toFixed(2)} credits`,
    );

    return { jobId, creditsDeducted: totalCredits };
  }

  /**
   * Check multiple domains asynchronously via queue in batches
   */
  async checkDomainsBulk(
    dto: BulkCheckDomainsDto,
    userId: string,
  ): Promise<{ batchId: string; creditsDeducted: number }> {
    const enabledRegistrars =
      this.configService
        .get<string>('ENABLED_REGISTRARS')
        ?.split(',')
        .filter((r) => r.trim()).length || 4;

    const creditPerCheck =
      this.configService.get<number>('credits.perRegistrarQuery') || 0.05;

    const totalCredits =
      dto.domains.length * enabledRegistrars * creditPerCheck;

    const balance = await this.creditsService.getBalance(userId);
    if (balance.balance < totalCredits) {
      throw new InsufficientCreditsException(totalCredits, balance.balance);
    }

    await this.creditsService.deductCredits(
      userId,
      totalCredits,
      `Bulk domain check of ${dto.domains.length} domains`,
      { count: dto.domains.length },
    );

    const batchId = `batch-${Date.now()}`;

    // Chunk domains into batches of 20 to leverage our bulk APIs
    const chunkSize = 20;
    const batches: Array<Array<{ domain: string; tld: string }>> = [];
    for (let i = 0; i < dto.domains.length; i += chunkSize) {
      batches.push(dto.domains.slice(i, i + chunkSize));
    }

    // Add job for each batch
    for (const batch of batches) {
      const batchCredits = batch.length * enabledRegistrars * creditPerCheck;

      await this.checkingProducer.addJob({
        userId,
        domains: batch,
        creditsDeducted: batchCredits,
        parentJobId: batchId,
      });
    }

    this.logger.log(
      `Created bulk check batch ${batchId} with ${batches.length} jobs (total ${dto.domains.length} checks) for user ${userId}, deducted ${totalCredits.toFixed(2)} credits`,
    );

    return { batchId, creditsDeducted: totalCredits };
  }

  /**
   * Get all saved searches/history for a user
   */
  async getSavedSearches(userId: string) {
    const db = this.databaseService.getDb();
    return db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.createdAt));
  }

  /**
   * Get all bookmarked domains for a user
   */
  async getBookmarks(userId: string) {
    const db = this.databaseService.getDb();
    return db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));
  }

  /**
   * Add a domain bookmark
   */
  async addBookmark(
    userId: string,
    domain: string,
    extension: string,
    pricesSnapshot?: any,
  ) {
    const db = this.databaseService.getDb();

    // Check if it already exists
    const [existing] = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.domain, domain)));

    if (existing) {
      return existing;
    }

    const [record] = await db
      .insert(bookmarks)
      .values({
        userId,
        domain,
        extension,
        pricesSnapshot: pricesSnapshot ? JSON.stringify(pricesSnapshot) : null,
        createdAt: new Date(),
      })
      .returning();

    return record;
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(userId: string, domain: string) {
    const db = this.databaseService.getDb();
    return db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.domain, domain)));
  }
}
