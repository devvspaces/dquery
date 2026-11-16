import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 50;
}

export class UsersQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export class DaysQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days = 30;
}

export class AdjustCreditsDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(-100_000) @Max(100_000) delta: number;
  @IsString() @IsNotEmpty() @MaxLength(300) reason: string;
  /** Client-generated id so a double-submit is applied once. */
  @IsUUID() requestId: string;
}

export class SuspendDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class SettingValueDto {
  /** Shape depends on the setting; validated against the registry. */
  @IsDefined() value: unknown;
}

export class SyncDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  registrars?: string[];
}

export class PricesQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(63) tld?: string;
  @IsOptional() @IsString() @MaxLength(50) registrar?: string;
  @IsOptional()
  @IsIn(['catalog-api', 'catalog-static', 'manual'])
  source?: string;
}

export class ManualPriceDto {
  @IsString() @Matches(/^[a-z0-9-]{2,50}$/) registrar: string;
  @IsString()
  @Matches(/^\.?[a-z0-9-]+(\.[a-z0-9-]+)*$/i)
  @MaxLength(63)
  tld: string;
  @IsNumber() @Min(0) @Max(1_000_000) register: number;
  @IsNumber() @Min(0) @Max(1_000_000) renew: number;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency = 'USD';
}

export class PaymentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['pending', 'completed', 'failed', 'refunded'])
  status?: string;
}

export class LinkTestQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+(\.[a-z0-9-]+){1,3}$/i)
  @MaxLength(253)
  domain?: string;
}
