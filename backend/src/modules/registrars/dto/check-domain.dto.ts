import type {
  AvailabilityStatus,
  PriceSource,
} from '../interfaces/registrar-provider.interface';
import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckDomainDto {
  @IsString()
  @IsNotEmpty()
  domain: string;

  @IsString()
  @IsNotEmpty()
  tld: string;
}

export class DomainTldPair {
  @IsString()
  @IsNotEmpty()
  domain: string;

  @IsString()
  @IsNotEmpty()
  tld: string;
}

export class BulkCheckDomainsDto {
  @IsArray()
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
