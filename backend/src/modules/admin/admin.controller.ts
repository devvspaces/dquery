import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../../database/schema';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../settings/audit.service';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminUsersService } from './admin-users.service';
import { AdminOpsService } from './admin-ops.service';
import {
  AdjustCreditsDto,
  DaysQueryDto,
  ManualPriceDto,
  PageQueryDto,
  PaymentsQueryDto,
  PricesQueryDto,
  SettingValueDto,
  SuspendDto,
  SyncDto,
  UsersQueryDto,
} from './dto/admin.dto';

/** Everything under /api/admin requires an ADMIN_EMAILS account. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly metrics: AdminMetricsService,
    private readonly users: AdminUsersService,
    private readonly ops: AdminOpsService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // Metrics
  @Get('metrics/summary')
  summary(@Query() q: DaysQueryDto) {
    return this.metrics.summary(q.days);
  }

  @Get('metrics/llm')
  llm(@Query() q: DaysQueryDto) {
    return this.metrics.llmUsage(q.days);
  }

  // Users
  @Get('users')
  listUsers(@Query() q: UsersQueryDto) {
    return this.users.list(q.q, q.page, q.limit);
  }

  @Get('users/:id')
  user(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.detail(id);
  }

  @Post('users/:id/credits')
  adjust(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustCreditsDto,
    @CurrentUser() admin: User,
  ) {
    return this.users.adjustCredits(
      id,
      dto.delta,
      dto.reason,
      dto.requestId,
      admin.email,
    );
  }

  @Post('users/:id/suspend')
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendDto,
    @CurrentUser() admin: User,
  ) {
    return this.users.setSuspended(id, true, admin.email, dto.reason);
  }

  @Post('users/:id/unsuspend')
  unsuspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: User,
  ) {
    return this.users.setSuspended(id, false, admin.email);
  }

  // Registrars & prices
  @Get('registrars')
  registrars() {
    return this.ops.registrarHealth();
  }

  @Get('registrars/sync-runs')
  syncRuns() {
    return this.ops.syncRuns();
  }

  @Post('registrars/sync')
  sync(@Body() dto: SyncDto, @CurrentUser() admin: User) {
    return this.ops.runSync(dto.registrars, admin.email);
  }

  @Get('prices')
  prices(@Query() q: PricesQueryDto) {
    return this.ops.listPrices(q);
  }

  @Put('prices')
  setPrice(@Body() dto: ManualPriceDto, @CurrentUser() admin: User) {
    return this.ops.setManualPrice(dto, admin.email);
  }

  @Delete('prices/:registrar/:tld')
  deletePrice(
    @Param('registrar') registrar: string,
    @Param('tld') tld: string,
    @CurrentUser() admin: User,
  ) {
    return this.ops.deleteManualPrice(registrar, tld, admin.email);
  }

  @Get('fx')
  fx() {
    return this.ops.fxRates();
  }

  // Settings
  @Get('settings')
  listSettings() {
    return {
      settings: this.settings.list(),
      secrets: this.settings.secretsStatus(),
    };
  }

  @Put('settings/:key')
  setSetting(
    @Param('key') key: string,
    @Body() dto: SettingValueDto,
    @CurrentUser() admin: User,
  ) {
    return this.settings.set(key, dto.value, admin.email);
  }

  @Delete('settings/:key')
  resetSetting(@Param('key') key: string, @CurrentUser() admin: User) {
    return this.settings.reset(key, admin.email);
  }

  // Ops
  @Get('ops/queues')
  queues() {
    return this.ops.queueStatus();
  }

  @Post('ops/queues/:queue/jobs/:jobId/retry')
  retry(
    @Param('queue') queue: string,
    @Param('jobId') jobId: string,
    @CurrentUser() admin: User,
  ) {
    return this.ops.retryJob(queue, jobId, admin.email);
  }

  @Get('payments')
  payments(@Query() q: PaymentsQueryDto) {
    return this.ops.payments(q.status, q.page, q.limit);
  }

  @Get('audit')
  auditLog(@Query() q: PageQueryDto) {
    return this.audit.list(q.page, q.limit);
  }
}
