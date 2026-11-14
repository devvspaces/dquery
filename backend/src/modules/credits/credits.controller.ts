import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CreditsService } from './credits.service';
import {
  CreditBalanceDto,
  CreditTransactionDto,
  CreditStatsDto,
  CreditEstimateDto,
  CreditEstimateRequestDto,
} from './dto';
import {
  PaginationDto,
  PaginatedResponse,
} from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../../database/schema';

@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  /**
   * Get current credit balance
   * GET /api/credits/balance
   */
  @Get('balance')
  async getBalance(@CurrentUser() user: User): Promise<CreditBalanceDto> {
    return this.creditsService.getBalance(user.id);
  }

  /**
   * Get transaction history with pagination
   * GET /api/credits/transactions?page=1&limit=20
   */
  @Get('transactions')
  async getTransactions(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<CreditTransactionDto>> {
    const { data, total } = await this.creditsService.getTransactionHistory(
      user.id,
      pagination,
    );

    const { page = 1, limit = 20 } = pagination;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Get credit statistics
   * GET /api/credits/stats
   */
  @Get('stats')
  async getStats(@CurrentUser() user: User): Promise<CreditStatsDto> {
    return this.creditsService.getCreditStats(user.id);
  }

  /**
   * Estimate credit cost for an operation
   * POST /api/credits/estimate
   * Body: { operation: 'generation' | 'check' | 'batch', domains?: number, registrars?: number }
   */
  @Post('estimate')
  async estimateCost(
    @Body() dto: CreditEstimateRequestDto,
  ): Promise<CreditEstimateDto> {
    return this.creditsService.estimateCost(
      dto.operation,
      dto.domains,
      dto.registrars,
    );
  }
}
