import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../../database/schema';
import { SearchesService } from './searches.service';
import {
  MoreNamesDto,
  RefreshSearchDto,
  SearchListQueryDto,
  UpdateSearchDto,
} from './dto/searches.dto';

/** Saved searches: reopen for free, refresh for credits. */
@Controller('searches')
export class SearchesController {
  constructor(
    private readonly searches: SearchesService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@CurrentUser() user: User, @Query() q: SearchListQueryDto) {
    return this.searches.list(user.id, q.page, q.limit, q.q);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.searches.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSearchDto,
  ) {
    return this.searches.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.searches.remove(user.id, id);
  }

  @Post(':id/refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefreshSearchDto,
  ) {
    if (dto.mode === 'prices') {
      return {
        mode: 'prices' as const,
        ...(await this.searches.refreshPrices(
          user.id,
          id,
          dto.pairs,
          dto.requestId,
        )),
      };
    }
    const res = await this.searches.refreshAvailability(
      user.id,
      id,
      dto.pairs,
      dto.requestId,
    );
    const prefix = this.config.get<string>('app.apiPrefix') || 'api';
    return {
      mode: 'availability' as const,
      ...res,
      sseUrl: `/${prefix}/domains/batch/${res.batchId}/stream`,
    };
  }

  @Post(':id/names')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  moreNames(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoreNamesDto,
  ) {
    return this.searches.moreNames(user.id, id, dto.requestId);
  }
}
