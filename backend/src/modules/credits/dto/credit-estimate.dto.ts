import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreditQuote, GenerationEngine } from '../credit-pricing.service';

export class CreditEstimateRequestDto {
  @IsIn(['generation', 'check'])
  operation: 'generation' | 'check';

  @IsOptional()
  @IsIn(['ai', 'words'])
  engine?: GenerationEngine;

  /** Generation: names to generate. Check: domains to check. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  names?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  tlds?: number;
}

export class CreditEstimateDto {
  operation: string;
  breakdown: CreditQuote;
  total: number;
  /** @deprecated use total */
  estimatedCost: number;

  constructor(operation: string, quote: CreditQuote) {
    this.operation = operation;
    this.breakdown = quote;
    this.total = quote.total;
    this.estimatedCost = quote.total;
  }
}
