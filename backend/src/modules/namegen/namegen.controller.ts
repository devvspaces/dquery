import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NamegenService } from './namegen.service';
import { PreviewRequestDto } from './dto/word-engine-config.dto';
import { UserThrottlerGuard } from '../../common/guards/user-throttler.guard';
import type { GeneratedName } from './types';

@Controller('namegen')
export class NamegenController {
  constructor(private readonly namegen: NamegenService) {}

  /**
   * Live preview for the word builder: names only, no availability checks.
   * Free (it costs us nothing to run) but limited to 30 requests a minute per user.
   * POST /api/namegen/preview
   */
  @Post('preview')
  @HttpCode(200)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  preview(@Body() dto: PreviewRequestDto): { names: GeneratedName[] } {
    return { names: this.namegen.generate({ ...dto, count: dto.count ?? 30 }) };
  }
}
