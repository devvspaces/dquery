import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DomainTldPair } from '../../registrars/dto/check-domain.dto';

export class SearchListQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class UpdateSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class RefreshSearchDto {
  /** prices: re-read the catalog (cheap); availability: live re-check. */
  @IsIn(['prices', 'availability'])
  mode: 'prices' | 'availability';

  /** Which saved domains; all of them when omitted. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => DomainTldPair)
  pairs?: DomainTldPair[];

  /** Client-generated id; a retried or double-clicked request is charged once. */
  @IsUUID()
  requestId: string;
}

export class MoreNamesDto {
  @IsUUID()
  requestId: string;
}
