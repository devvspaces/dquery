import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreditsService } from '../credits/credits.service';
import { CreditPricingService } from '../credits/credit-pricing.service';
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
import { SearchesService } from './searches.service';
import { bookmarks, savedSearches } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly creditsService: CreditsService,
    private readonly generationProducer: DomainGenerationProducer,
    private readonly checkingProducer: DomainCheckingProducer,
    private readonly pricing: CreditPricingService,
    private readonly databaseService: DatabaseService,
    private readonly searches: SearchesService,
  ) {}

  /**
   * Generate domains with automatic availability checking
   */
  async generateDomains(
    dto: GenerateDomainsDto,
    userId: string,
  ): Promise<{ jobId: string; creditsDeducted: number }> {
    const engine = dto.engine ?? 'ai';
    const businessName =
      dto.businessName?.trim() ||
      dto.wordEngine?.seeds.join(' ').trim() ||
      'Invented names';
    const autoCheck = dto.autoCheck !== false;
    const maxTlds = this.pricing.maxTlds();
    if (new Set(dto.tlds).size > maxTlds)
      throw new BadRequestException(
        `Pick at most ${maxTlds} extensions per search.`,
      );
    // Without auto-check only the generation fee is charged now; checks are
    // charged later when the user checks the names they kept.
    const quote = this.pricing.quoteGeneration(
      engine,
      autoCheck ? dto.count : 0,
      autoCheck ? dto.tlds.length : 0,
    );
    const totalCredits = quote.total;

    this.logger.log(
      `Credit calculation: generation=${quote.generation}, checking=${quote.checking} (${quote.checks} checks), total=${totalCredits}`,
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
      `${engine === 'words' ? 'Word engine' : 'AI'} generation (${dto.count} names) with availability checking (${dto.tlds.length} TLDs)`,
      {
        engine,
        businessName,
        count: dto.count,
        tlds: dto.tlds,
        style: dto.style,
      },
    );

    // Create generation job
    const jobId = await this.generationProducer.addJob({
      userId,
      engine,
      autoCheck,
      wordEngine: dto.wordEngine,
      businessName,
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
   * Get job status. Jobs belonging to another user are reported as not found.
   */
  async getJobStatus(jobId: string, userId: string): Promise<JobStatusDto> {
    const status =
      (await this.generationProducer.getJobStatus(jobId)) ??
      (await this.checkingProducer.getJobStatus(jobId));

    if (!status || status.userId !== userId) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return {
      jobId,
      status: status.status as JobStatusDto['status'],
      result: status.result,
      error: status.error,
      createdAt: new Date(),
    };
  }

  /**
   * Get batch status
   */
  async getBatchStatus(
    batchId: string,
    userId: string,
  ): Promise<BatchStatusDto> {
    // Only this user's jobs are counted, so another user's batch reads as empty.
    const batchStatus = await this.checkingProducer.getBatchStatus(
      batchId,
      userId,
    );

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
    const totalCredits = this.pricing.quoteChecks(1).total;

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
  ): Promise<{ batchId: string; creditsDeducted: number; searchId: string }> {
    const totalCredits = this.pricing.quoteChecks(dto.domains.length).total;
    const maxTlds = this.pricing.maxTlds();
    if (new Set(dto.domains.map((d) => d.tld)).size > maxTlds)
      throw new BadRequestException(
        `Pick at most ${maxTlds} extensions per search.`,
      );
    // Validate the search before charging (404 for someone else's).
    if (dto.searchId) await this.searches.attachCheck(userId, [], dto.searchId);

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

    const batchId = `batch-${randomUUID()}`;
    // Every check is stored on a saved search so it can be reopened later.
    const searchId = await this.searches.attachCheck(
      userId,
      dto.domains,
      dto.searchId,
      dto.title,
    );
    await this.searches.enqueueChecks(userId, searchId, dto.domains, batchId);

    this.logger.log(
      `Created bulk check batch ${batchId} (${dto.domains.length} checks, search ${searchId}) for user ${userId}, deducted ${totalCredits.toFixed(2)} credits`,
    );

    return { batchId, creditsDeducted: totalCredits, searchId };
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
