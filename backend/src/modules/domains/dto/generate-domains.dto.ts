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
