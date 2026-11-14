import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DomainGenerationRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  businessName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(100)
  count?: number = 30;

  @IsOptional()
  @IsIn(['creative', 'professional', 'short', 'descriptive'])
  style?: 'creative' | 'professional' | 'short' | 'descriptive';
}

export class DomainGenerationResponseDto {
  domains: string[];
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  estimatedCost: number;
  provider: string;
  model: string;
  generatedAt: Date;

  constructor(
    domains: string[],
    tokensUsed: { prompt: number; completion: number; total: number },
    estimatedCost: number,
    provider: string,
    model: string,
  ) {
    this.domains = domains;
    this.tokensUsed = tokensUsed;
    this.estimatedCost = estimatedCost;
    this.provider = provider;
    this.model = model;
    this.generatedAt = new Date();
  }
}
