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
import { PaymentsModule } from './modules/payments/payments.module';
import { NamegenModule } from './modules/namegen/namegen.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AdminModule } from './modules/admin/admin.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { QueuesModule } from './queues/queues.module';
import { BullBoardConfigModule } from './queues/bullboard.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import llmConfig from './config/llm.config';
import queueConfig from './queues/config/queue.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, llmConfig, queueConfig],
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
    SettingsModule,
    AuthModule,
    CreditsModule,
    LLMModule,
    RegistrarsModule,
    QueuesModule,
    DomainsModule,
    PaymentsModule,
    NamegenModule,
    AdminModule,
    // Limits are set per route with @Throttle; this is only the fallback.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
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
