import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsEnum,
} from 'class-validator';

export class GenerateDomainsDto {
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(10)
  @Max(100)
  count: number;

  @IsEnum(['creative', 'professional', 'short', 'descriptive'])
  @IsOptional()
  style?: 'creative' | 'professional' | 'short' | 'descriptive';

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  tlds: string[];
}

export class GenerateDomainsResponseDto {
  jobId: string;
  status: string;
  estimatedWaitTime: number;
  sseUrl: string;
  creditsDeducted: number;
}
