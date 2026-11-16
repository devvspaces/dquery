import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { QueuesModule } from '../../queues/queues.module';
import { CreditsModule } from '../credits/credits.module';
import { DatabaseModule } from '../../database/database.module';
import { RegistrarsModule } from '../registrars/registrars.module';
import { SearchesController } from './searches.controller';
import { SearchesService } from './searches.service';

@Module({
  imports: [
    ConfigModule,
    QueuesModule,
    CreditsModule,
    DatabaseModule,
    RegistrarsModule,
  ],
  controllers: [DomainsController, SearchesController],
  providers: [DomainsService, SearchesService],
  exports: [DomainsService],
})
export class DomainsModule {}
