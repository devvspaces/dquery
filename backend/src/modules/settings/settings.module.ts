import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { AuditService } from './audit.service';
import { SettingsService } from './settings.service';

/** Global: any service can read runtime settings or record an audit entry. */
@Global()
@Module({
  imports: [RedisModule],
  providers: [SettingsService, AuditService],
  exports: [SettingsService, AuditService],
})
export class SettingsModule {}
