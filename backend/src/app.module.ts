import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { CreditsModule } from './modules/credits/credits.module';
import { LLMModule } from './modules/llm/llm.module';
import { RegistrarsModule } from './modules/registrars/registrars.module';
import { DomainsModule } from './modules/domains/domains.module';
import { QueuesModule } from './queues/queues.module';
import { BullBoardConfigModule } from './queues/bullboard.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import creditsConfig from './config/credits.config';
import llmConfig from './config/llm.config';
import queueConfig from './queues/config/queue.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        creditsConfig,
        llmConfig,
        queueConfig,
      ],
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    CreditsModule,
    LLMModule,
    RegistrarsModule,
    QueuesModule,
    DomainsModule,
    BullBoardConfigModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
