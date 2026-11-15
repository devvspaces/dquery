import type {
  AvailabilityStatus,
  PriceSource,
} from '../interfaces/registrar-provider.interface';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CheckDomainDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  domain: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  tld: string;
}

export class DomainTldPair {
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  domain: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  tld: string;
}

export class BulkCheckDomainsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DomainTldPair)
  domains: DomainTldPair[];
}

export class CheckDomainResponseDto {
  domain: string;
  tld: string;
  /** true only when status === 'available' (kept for older clients). */
  available: boolean;
  status: AvailabilityStatus;
  /** First-year registration price. */
  price?: number;
  renewalPrice?: number;
  transferPrice?: number;
  threeYearTotal?: number;
  isPromo?: boolean;
  currency?: string;
  registrar: string;
  premiumDomain?: boolean;
  priceSource?: PriceSource;
  stale?: boolean;
  reason?: string;
  error?: string;
  checkedAt: Date;
}

export class BulkCheckResponseDto {
  results: CheckDomainResponseDto[];
  totalChecked: number;
  availableCount: number;
  unavailableCount: number;
  errorCount: number;
  /** Offers where registry status could not be determined (provider errors). */
  unknownCount: number;
  registrarsUsed: string[];
}
