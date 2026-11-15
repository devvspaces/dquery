import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TECHNIQUES, type Feel, type Technique } from '../types';

export class WordEngineConfigDto {
  /** The user's own words or name. Empty means invent from scratch. */
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  seeds: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TECHNIQUES.length)
  @IsIn(TECHNIQUES, { each: true })
  strategies?: Technique[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @Matches(/^[CVcv]{2,10}$/, {
    each: true,
    message: 'patterns must be 2–10 letters of C (consonant) and V (vowel)',
  })
  patterns?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(12, { each: true })
  prefixes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(12, { each: true })
  suffixes?: string[];

  @IsOptional()
  @IsBoolean()
  useBuiltInAffixes?: boolean;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(30)
  minLen?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(30)
  maxLen?: number;

  @IsOptional()
  @IsBoolean()
  allowHyphen?: boolean;

  @IsOptional()
  @IsBoolean()
  allowDigits?: boolean;

  @IsOptional()
  @IsIn(['neutral', 'light', 'strong'])
  feel?: Feel;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2 ** 31)
  seed?: number;
}

export class PreviewRequestDto extends WordEngineConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;
}
