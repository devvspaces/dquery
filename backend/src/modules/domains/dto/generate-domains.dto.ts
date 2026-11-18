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
  IsIn,
  IsBoolean,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WordEngineConfigDto } from '../../namegen/dto/word-engine-config.dto';

export class GenerateDomainsDto {
  /** 'ai' (LLM) or 'words' (rule-based word engine). Defaults to 'ai'. */
  @IsOptional()
  @IsIn(['ai', 'words'])
  engine?: 'ai' | 'words';

  /**
   * true (default): check every name × TLD straight away (charged up front).
   * false: only generate names; the client reviews them and then calls
   * /domains/check/bulk for the ones it keeps.
   */
  @IsOptional()
  @IsBoolean()
  autoCheck?: boolean;

  /** Required when engine is 'words'. */
  @ValidateIf((o: GenerateDomainsDto) => o.engine === 'words')
  @ValidateNested()
  @Type(() => WordEngineConfigDto)
  wordEngine?: WordEngineConfigDto;

  /** Required for AI generation; optional for the word engine (seeds are used). */
  @ValidateIf((o: GenerateDomainsDto) => o.engine !== 'words')
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
  // Hard ceiling; the configurable limit (search.maxTlds) is checked in the service.
  @ArrayMaxSize(50)
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
