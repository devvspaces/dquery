import { Command, Option } from 'nestjs-command';
import { Injectable } from '@nestjs/common';
import { TldPricesService } from './tld-prices.service';

@Injectable()
export class RegistrarsCommand {
  constructor(private readonly tldPricesService: TldPricesService) {}

  @Command({
    command: 'prices:sync',
    describe: 'Synchronize standard TLD prices from registrar price catalogs',
  })
  async sync(
    @Option({
      name: 'registrar',
      describe:
        'Only sync these registrars (comma-separated ids, e.g. namecheap,porkbun)',
      type: 'string',
      required: false,
    })
    registrar?: string,
  ) {
    console.log('🔄 Synchronizing TLD price catalogs...');
    const only = registrar
      ?.split(',')
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);
    const reports = await this.tldPricesService.syncAllPrices(only);
    if (reports.length === 0) {
      console.log('⚠️  No configured price-catalog providers matched.');
    }
    for (const r of reports) {
      console.log(
        r.ok
          ? `✅ ${r.registrar}: ${r.count} TLD prices`
          : `❌ ${r.registrar}: ${r.error}`,
      );
    }
  }

  @Command({
    command: 'prices:set',
    describe:
      'Manually set a standard TLD price for a registrar (never overwritten by sync)',
  })
  async set(
    @Option({
      name: 'registrar',
      describe: 'Registrar name (e.g. namecheap, spaceship)',
      type: 'string',
      required: true,
    })
    registrar: string,
    @Option({
      name: 'tld',
      describe: 'TLD extension (e.g. com, net, io)',
      type: 'string',
      required: true,
    })
    tld: string,
    @Option({
      name: 'register',
      describe: 'Standard registration price',
      type: 'number',
      required: true,
    })
    register: number,
    @Option({
      name: 'renew',
      describe: 'Standard renewal price',
      type: 'number',
      required: true,
    })
    renew: number,
    @Option({
      name: 'currency',
      describe: 'Currency code (default: USD)',
      type: 'string',
      required: false,
      default: 'USD',
    })
    currency: string,
  ) {
    console.log(`🌱 Setting pricing for ${registrar} .${tld}...`);
    try {
      await this.tldPricesService.setTldPrice(
        registrar,
        tld,
        register,
        renew,
        currency,
      );
      console.log(`✅ Pricing successfully set for ${registrar} .${tld}!`);
    } catch (error) {
      console.error('❌ Failed to set standard TLD pricing:', error.message);
    }
  }
}
