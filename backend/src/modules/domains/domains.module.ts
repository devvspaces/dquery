import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { QueuesModule } from '../../queues/queues.module';
import { CreditsModule } from '../credits/credits.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [ConfigModule, QueuesModule, CreditsModule, DatabaseModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
