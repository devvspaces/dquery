import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreditEstimateRequestDto {
  @IsString()
  operation: 'generation' | 'check' | 'batch';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  domains?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  registrars?: number;
}

export class CreditEstimateDto {
  operation: string;
  estimatedCost: number;
  breakdown: {
    baseOperation?: number;
    perDomain?: number;
    perRegistrar?: number;
    domains?: number;
    registrars?: number;
  };
  total: number;

  constructor(operation: string, breakdown: any, total: number) {
    this.operation = operation;
    this.breakdown = breakdown;
    this.estimatedCost = total;
    this.total = total;
  }
}
