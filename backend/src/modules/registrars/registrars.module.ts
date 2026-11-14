import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommandModule } from 'nestjs-command';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';
import { RegistrarsController } from './registrars.controller';
import { RegistrarsService } from './registrars.service';
import { GoDaddyProvider } from './providers/godaddy.provider';
import { CloudflareProvider } from './providers/cloudflare.provider';
import { NamecheapProvider } from './providers/namecheap.provider';
import { SpaceshipProvider } from './providers/spaceship.provider';
import { PorkbunProvider } from './providers/porkbun.provider';
import { TldPricesService } from './tld-prices.service';
import { RegistrarsCommand } from './registrars.command';
import { REGISTRAR_PROVIDERS } from './interfaces/registrar-provider.interface';

/**
 * To add a registrar: create its provider class, add it to PROVIDER_CLASSES.
 * Nothing else in the aggregator needs to change.
 */
const PROVIDER_CLASSES = [
  CloudflareProvider,
  NamecheapProvider,
  SpaceshipProvider,
  GoDaddyProvider,
  PorkbunProvider,
];

@Module({
  imports: [ConfigModule, DatabaseModule, RedisModule, CommandModule],
  controllers: [RegistrarsController],
  providers: [
    ...PROVIDER_CLASSES,
    {
      provide: REGISTRAR_PROVIDERS,
      useFactory: (...providers: unknown[]) => providers,
      inject: PROVIDER_CLASSES,
    },
    RegistrarsService,
    TldPricesService,
    RegistrarsCommand,
  ],
  exports: [RegistrarsService, TldPricesService],
})
export class RegistrarsModule {}
