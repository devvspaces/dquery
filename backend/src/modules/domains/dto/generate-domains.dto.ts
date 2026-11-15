import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsEnum,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class GenerateDomainsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessName: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(10)
  @Max(50)
  count: number;

  @IsEnum(['creative', 'professional', 'short', 'descriptive'])
  @IsOptional()
  style?: 'creative' | 'professional' | 'short' | 'descriptive';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(24, { each: true })
  tlds: string[];
}

export class GenerateDomainsResponseDto {
  jobId: string;
  status: string;
  estimatedWaitTime: number;
  sseUrl: string;
  creditsDeducted: number;
}
