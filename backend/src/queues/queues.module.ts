import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { LLMModule } from '../modules/llm/llm.module';
import { CreditsModule } from '../modules/credits/credits.module';
import { RegistrarsModule } from '../modules/registrars/registrars.module';
import { QUEUE_NAMES } from './constants/queue-names';
import { DomainGenerationProducer } from './producers/domain-generation.producer';
import { DomainCheckingProducer } from './producers/domain-checking.producer';
import { DomainGenerationProcessor } from './processors/domain-generation.processor';
import { DomainCheckingProcessor } from './processors/domain-checking.processor';
import { PriceSyncProcessor } from './processors/price-sync.processor';
import { PriceSyncScheduler } from './producers/price-sync.scheduler';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('queue.redis.host') || 'localhost',
          port: configService.get<number>('queue.redis.port') || 6379,
          password: configService.get<string>('queue.redis.password'),
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.DOMAIN_GENERATION,
      },
      {
        name: QUEUE_NAMES.DOMAIN_CHECKING,
      },
      {
        name: QUEUE_NAMES.PRICE_SYNC,
      },
    ),
    DatabaseModule,
    LLMModule,
    CreditsModule,
    RegistrarsModule,
  ],
  providers: [
    DomainGenerationProducer,
    DomainCheckingProducer,
    DomainGenerationProcessor,
    DomainCheckingProcessor,
    PriceSyncProcessor,
    PriceSyncScheduler,
  ],
  exports: [DomainGenerationProducer, DomainCheckingProducer],
})
export class QueuesModule {}
