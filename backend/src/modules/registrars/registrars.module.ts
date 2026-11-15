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
import { OvhProvider } from './providers/ovh.provider';
import { NameComProvider } from './providers/namecom.provider';
import { NameSiloProvider } from './providers/namesilo.provider';
import { DynadotProvider } from './providers/dynadot.provider';
import { HostingerProvider } from './providers/hostinger.provider';
import { WhmcsFeedProvider } from './providers/whmcs-feed.provider';
import { TldPricesService } from './tld-prices.service';
import { FxRatesService } from './fx-rates.service';
import { RegistrarsCommand } from './registrars.command';
import { REGISTRAR_PROVIDERS } from './interfaces/registrar-provider.interface';

/**
 * To add a registrar: create its provider class, add it to PROVIDER_CLASSES.
 * WHMCS-based registrars need no code: add them to REGISTRARS_WHMCS.
 * Nothing else in the aggregator needs to change. Providers without
 * credentials are skipped automatically.
 */
const PROVIDER_CLASSES = [
  CloudflareProvider,
  NamecheapProvider,
  SpaceshipProvider,
  GoDaddyProvider,
  PorkbunProvider,
  OvhProvider,
  NameComProvider,
  NameSiloProvider,
  DynadotProvider,
  HostingerProvider,
];

@Module({
  imports: [ConfigModule, DatabaseModule, RedisModule, CommandModule],
  controllers: [RegistrarsController],
  providers: [
    ...PROVIDER_CLASSES,
    {
      provide: REGISTRAR_PROVIDERS,
      useFactory: (...providers: unknown[]) => [
        ...providers,
        ...WhmcsFeedProvider.fromEnv(),
      ],
      inject: PROVIDER_CLASSES,
    },
    RegistrarsService,
    TldPricesService,
    FxRatesService,
    RegistrarsCommand,
  ],
  exports: [RegistrarsService, TldPricesService],
})
export class RegistrarsModule {}
