import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { RegistrarsService } from './registrars.service';
import {
  CheckDomainDto,
  BulkCheckDomainsDto,
  CheckDomainResponseDto,
  BulkCheckResponseDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../../database/schema';
import type { DomainAvailability } from './interfaces/registrar-provider.interface';

function toResponse(r: DomainAvailability): CheckDomainResponseDto {
  return {
    domain: r.domain,
    tld: r.tld,
    available: r.available,
    status: r.status,
    price: r.price,
    renewalPrice: r.renewalPrice,
    transferPrice: r.transferPrice,
    threeYearTotal: r.threeYearTotal,
    isPromo: r.isPromo,
    currency: r.currency,
    registrar: r.registrar,
    premiumDomain: r.premiumDomain,
    priceSource: r.priceSource,
    stale: r.stale,
    reason: r.reason,
    error: r.error,
    checkedAt: r.checkedAt,
  };
}

@Controller('registrars')
export class RegistrarsController {
  constructor(private readonly registrarsService: RegistrarsService) {}

  /**
   * Check domain availability across all registrars (admin/debug; uncharged).
   * Users go through the charged /api/domains/check* routes.
   * POST /api/registrars/check
   */
  @UseGuards(AdminGuard)
  @Post('check')
  async checkDomain(
    @Body() dto: CheckDomainDto,
    @CurrentUser() user: User,
  ): Promise<CheckDomainResponseDto[]> {
    const results = await this.registrarsService.checkDomainAvailability(
      dto.domain,
      dto.tld,
      user.id,
    );

    return results.map(toResponse);
  }

  /**
   * Check multiple domains (admin/debug; uncharged)
   * POST /api/registrars/check/bulk
   */
  @UseGuards(AdminGuard)
  @Post('check/bulk')
  async checkDomainsBulk(
    @Body() dto: BulkCheckDomainsDto,
    @CurrentUser() user: User,
  ): Promise<BulkCheckResponseDto> {
    const resultsMap = await this.registrarsService.checkDomainsBulk(
      dto.domains,
      user.id,
    );

    const allResults: CheckDomainResponseDto[] = [];
    const registrarsUsed = new Set<string>();

    for (const [, domainResults] of resultsMap) {
      for (const result of domainResults) {
        allResults.push(toResponse(result));
        registrarsUsed.add(result.registrar);
      }
    }

    const availableCount = allResults.filter(
      (r) => r.status === 'available',
    ).length;
    const unavailableCount = allResults.filter(
      (r) => r.status === 'taken',
    ).length;
    const unknownCount = allResults.filter(
      (r) => r.status === 'unknown',
    ).length;
    const errorCount = allResults.filter((r) => r.error).length;

    return {
      results: allResults,
      totalChecked: allResults.length,
      availableCount,
      unavailableCount,
      errorCount,
      unknownCount,
      registrarsUsed: Array.from(registrarsUsed),
    };
  }

  /**
   * Get best price for a domain
   * GET /api/registrars/best-price?domain=example&tld=com (admin/debug; uncharged)
   */
  @UseGuards(AdminGuard)
  @Get('best-price')
  async getBestPrice(
    @Query('domain') domain: string,
    @Query('tld') tld: string,
  ): Promise<CheckDomainResponseDto | null> {
    const result = await this.registrarsService.getBestPrice(domain, tld);

    if (!result) {
      return null;
    }

    return toResponse(result);
  }

  /**
   * Get all supported TLDs
   * GET /api/registrars/tlds
   */
  @Get('tlds')
  async getSupportedTlds(): Promise<{ tlds: string[]; count: number }> {
    const tlds = await this.registrarsService.getAllSupportedTlds();
    return {
      tlds,
      count: tlds.length,
    };
  }

  /**
   * Get supported TLDs for a specific provider
   * GET /api/registrars/tlds/:provider
   */
  @Get('tlds/:provider')
  async getProviderTlds(
    @Param('provider') provider: string,
  ): Promise<{ provider: string; tlds: string[]; count: number }> {
    const tlds = await this.registrarsService.getProviderTlds(provider);
    return {
      provider,
      tlds,
      count: tlds.length,
    };
  }
}
