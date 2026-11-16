import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Logger,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { DatabaseService } from '../../database/database.service';
import { buyClicks } from '../../database/schema';
import { RegistrarsService } from './registrars.service';
import { errorMessage } from './utils/domain.util';

const TLD =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)?$/;
const FQDN =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?){1,3}$/;

/**
 * Unauthenticated endpoints: the price catalog for the public price pages,
 * and the Buy click-through (counts the click, then redirects).
 */
@Public()
@Controller()
export class PublicController {
  private readonly logger = new Logger(PublicController.name);

  constructor(
    private readonly registrars: RegistrarsService,
    private readonly db: DatabaseService,
  ) {}

  @Get('public/tlds')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=86400',
  )
  catalog() {
    return this.registrars.publicCatalog();
  }

  @Get('public/tlds/:tld')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Header(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=86400',
  )
  async tld(@Param('tld') raw: string) {
    const tld = raw.trim().toLowerCase().replace(/^\./, '');
    if (!TLD.test(tld)) throw new BadRequestException('Invalid TLD');
    const detail = await this.registrars.publicTld(tld);
    if (detail.offers.length === 0)
      throw new NotFoundException('No prices for this TLD');
    return detail;
  }

  /**
   * GET /api/out/:registrar?d=example.com → 302 to that registrar's buy page.
   * The URL is built server-side from the registrar's own template, so this
   * can't be used to redirect anywhere else.
   */
  @Get('out/:registrar')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async out(
    @Param('registrar') registrar: string,
    @Query('d') d: string | undefined,
    @Res() res: Response,
  ) {
    const id = registrar.trim().toLowerCase();
    const fqdn = (d ?? '').trim().toLowerCase();
    if (!this.registrars.hasRegistrar(id))
      throw new NotFoundException('Unknown registrar');
    if (!FQDN.test(fqdn)) throw new BadRequestException('Invalid domain');
    const url = this.registrars.buyUrl(id, fqdn);
    if (!url) throw new NotFoundException('No buy link for this registrar');

    const tld = fqdn.slice(fqdn.indexOf('.') + 1);
    void this.db
      .getDb()
      .insert(buyClicks)
      .values({
        registrar: id,
        tld,
        affiliate: this.registrars.hasAffiliate(id),
      })
      .catch((err) =>
        this.logger.warn(`Click not recorded: ${errorMessage(err)}`),
      );

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.redirect(302, url);
  }
}
