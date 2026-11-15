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
import { Public } from '../../common/decorators/public.decorator';
import {
  CreditPricingService,
  type CreditPricing,
} from './credit-pricing.service';

@Controller('credits')
export class CreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly pricingService: CreditPricingService,
  ) {}

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
   * Body: { operation: 'generation' | 'check', engine?: 'ai' | 'words', names?: number, tlds?: number }
   */
  @Post('estimate')
  estimateCost(@Body() dto: CreditEstimateRequestDto): CreditEstimateDto {
    return this.creditsService.estimateCost(dto);
  }

  /**
   * Current credit prices, for showing costs before a search.
   * GET /api/credits/pricing
   */
  @Public()
  @Get('pricing')
  getPricing(): CreditPricing {
    return this.pricingService.pricing();
  }

  /**
   * Sign-up promo: early-user grant and spots remaining.
   * GET /api/credits/promo
   */
  @Public()
  @Get('promo')
  getPromo() {
    return this.creditsService.getPromo();
  }
}
