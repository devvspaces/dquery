import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { RegistrarsModule } from '../registrars/registrars.module';
import { QueuesModule } from '../../queues/queues.module';
import { AdminController } from './admin.controller';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminUsersService } from './admin-users.service';
import { AdminOpsService } from './admin-ops.service';

@Module({
  imports: [CreditsModule, RegistrarsModule, QueuesModule],
  controllers: [AdminController],
  providers: [AdminMetricsService, AdminUsersService, AdminOpsService],
})
export class AdminModule {}
