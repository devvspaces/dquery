import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Sse,
  MessageEvent,
  Delete,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { DomainsService } from './domains.service';
import {
  GenerateDomainsDto,
  GenerateDomainsResponseDto,
  JobStatusDto,
  BatchStatusDto,
} from './dto';
import {
  CheckDomainDto,
  BulkCheckDomainsDto,
} from '../registrars/dto/check-domain.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../../database/schema';

@Controller('domains')
export class DomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate domains with automatic availability checking
   * POST /api/domains/generate
   */
  @Post('generate')
  async generateDomains(
    @Body() dto: GenerateDomainsDto,
    @CurrentUser() user: User,
  ): Promise<GenerateDomainsResponseDto> {
    const { jobId, creditsDeducted } =
      await this.domainsService.generateDomains(dto, user.id);

    const apiPrefix = this.configService.get<string>('app.apiPrefix') || 'api';
    const sseUrl = `/${apiPrefix}/domains/jobs/${jobId}/stream`;

    return {
      jobId,
      status: 'queued',
      estimatedWaitTime: 15,
      sseUrl,
      creditsDeducted,
    };
  }

  /**
   * Get job status (polling endpoint)
   * GET /api/domains/jobs/:jobId
   */
  @Get('jobs/:jobId')
  async getJobStatus(
    @Param('jobId') jobId: string,
    @CurrentUser() user: User,
  ): Promise<JobStatusDto> {
    return this.domainsService.getJobStatus(jobId, user.id);
  }

  /**
   * Stream job updates via Server-Sent Events
   * GET /api/domains/jobs/:jobId/stream
   */
  @Sse('jobs/:jobId/stream')
  streamJobUpdates(
    @Param('jobId') jobId: string,
    @CurrentUser() user: User,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let lastStatus: string | null = null;

      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- errors are caught inside
      const pollInterval = setInterval(async () => {
        try {
          const status = await this.domainsService.getJobStatus(jobId, user.id);

          // Emit if status changes, or if it is the final status
          if (
            status.status !== lastStatus ||
            status.status === 'completed' ||
            status.status === 'failed'
          ) {
            lastStatus = status.status;
            subscriber.next({
              type: `job:${status.status}`,
              data: {
                jobId,
                status: status.status,
                timestamp: new Date(),
                result: status.result,
                error: status.error,
              },
            });
          }

          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(pollInterval);
            subscriber.complete();
          }
        } catch (error) {
          subscriber.next({
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          clearInterval(pollInterval);
          subscriber.error(error);
        }
      }, 1500);

      return () => {
        clearInterval(pollInterval);
      };
    });
  }

  /**
   * Get batch status
   * GET /api/domains/batch/:batchId
   */
  @Get('batch/:batchId')
  async getBatchStatus(
    @Param('batchId') batchId: string,
    @CurrentUser() user: User,
  ): Promise<BatchStatusDto> {
    return this.domainsService.getBatchStatus(batchId, user.id);
  }

  /**
   * Stream batch updates via Server-Sent Events
   * GET /api/domains/batch/:batchId/stream
   */
  @Sse('batch/:batchId/stream')
  streamBatchUpdates(
    @Param('batchId') batchId: string,
    @CurrentUser() user: User,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- errors are caught inside
      const pollInterval = setInterval(async () => {
        try {
          const status = await this.domainsService.getBatchStatus(
            batchId,
            user.id,
          );

          subscriber.next({
            type: 'batch:update',
            data: status,
          });

          // Complete stream if batch finishes checking
          if (
            status.completed + status.failed >= status.total &&
            status.total > 0
          ) {
            clearInterval(pollInterval);
            subscriber.complete();
          }
        } catch (error) {
          subscriber.next({
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          clearInterval(pollInterval);
          subscriber.error(error);
        }
      }, 2000);

      return () => {
        clearInterval(pollInterval);
      };
    });
  }

  /**
   * Check single domain availability asynchronously via queue
   * POST /api/domains/check
   */
  @Post('check')
  async checkDomain(
    @Body() dto: CheckDomainDto,
    @CurrentUser() user: User,
  ): Promise<{
    jobId: string;
    status: string;
    sseUrl: string;
    creditsDeducted: number;
  }> {
    const { jobId, creditsDeducted } =
      await this.domainsService.checkDomainAvailability(dto, user.id);

    const apiPrefix = this.configService.get<string>('app.apiPrefix') || 'api';
    const sseUrl = `/${apiPrefix}/domains/jobs/${jobId}/stream`;

    return {
      jobId,
      status: 'queued',
      sseUrl,
      creditsDeducted,
    };
  }

  /**
   * Check multiple domains asynchronously via queue in batches
   * POST /api/domains/check/bulk
   */
  @Post('check/bulk')
  async checkDomainsBulk(
    @Body() dto: BulkCheckDomainsDto,
    @CurrentUser() user: User,
  ): Promise<{
    batchId: string;
    status: string;
    sseUrl: string;
    creditsDeducted: number;
  }> {
    const { batchId, creditsDeducted } =
      await this.domainsService.checkDomainsBulk(dto, user.id);

    const apiPrefix = this.configService.get<string>('app.apiPrefix') || 'api';
    const sseUrl = `/${apiPrefix}/domains/batch/${batchId}/stream`;

    return {
      batchId,
      status: 'queued',
      sseUrl,
      creditsDeducted,
    };
  }

  /**
   * Get search history
   * GET /api/domains/searches
   */
  @Get('searches')
  async getSavedSearches(@CurrentUser() user: User) {
    return this.domainsService.getSavedSearches(user.id);
  }

  /**
   * Get all bookmarks
   * GET /api/domains/bookmarks
   */
  @Get('bookmarks')
  async getBookmarks(@CurrentUser() user: User) {
    return this.domainsService.getBookmarks(user.id);
  }

  /**
   * Add a bookmark
   * POST /api/domains/bookmarks
   */
  @Post('bookmarks')
  async addBookmark(
    @Body() body: { domain: string; extension: string; pricesSnapshot?: any },
    @CurrentUser() user: User,
  ) {
    return this.domainsService.addBookmark(
      user.id,
      body.domain,
      body.extension,
      body.pricesSnapshot,
    );
  }

  /**
   * Delete a bookmark
   * DELETE /api/domains/bookmarks/:domain
   */
  @Delete('bookmarks/:domain')
  async deleteBookmark(
    @Param('domain') domain: string,
    @CurrentUser() user: User,
  ) {
    return this.domainsService.deleteBookmark(user.id, domain);
  }
}
