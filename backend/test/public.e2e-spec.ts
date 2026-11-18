import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { and, eq, like } from 'drizzle-orm';
import { AppModule } from './../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { buyClicks, tldPrices } from '../src/database/schema';
import { TldPricesService } from '../src/modules/registrars/tld-prices.service';
import { RegistrarsService } from '../src/modules/registrars/registrars.service';

/** Unauthenticated price pages API and the Buy click-through. */
describe('Public prices and buy links (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<DatabaseService['getDb']>;
  const tld = `e2e${Date.now().toString(36)}`;
  const http = () => request(app.getHttpServer());
  // Two registrars that are enabled in this environment.
  let cheap: string; // 9 then 30/yr → 3y 69
  let flat: string; // 20/yr → 3y 60

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    db = app.get(DatabaseService).getDb();
    const prices = app.get(TldPricesService);
    const enabled = app
      .get(RegistrarsService)
      .describeProviders()
      .filter((p) => p.enabled)
      .map((p) => p.id);
    [cheap, flat] = enabled;
    await prices.setTldPrice(cheap, tld, 9, 30);
    await prices.setTldPrice(flat, tld, 20, 20);
  }, 30_000);

  afterAll(async () => {
    await db.delete(tldPrices).where(eq(tldPrices.tld, tld));
    await db.delete(buyClicks).where(eq(buyClicks.tld, tld));
    await app?.close();
  }, 30_000);

  it('serves a TLD price page without auth, cheapest 3-year first', async () => {
    const res = await http()
      .get(`/public/tlds/.${tld.toUpperCase()}`)
      .expect(200);
    expect(res.headers['cache-control']).toContain('s-maxage');
    expect(res.body.tld).toBe(tld);
    expect(
      res.body.offers.map((o: { registrarId: string }) => o.registrarId),
    ).toEqual([flat, cheap]);
    expect(res.body.offers[1]).toMatchObject({
      registerPrice: 9,
      renewalPrice: 30,
      threeYearTotal: 69,
      isPromo: true,
    });
  });

  it('lists every priced extension in the picker index', async () => {
    const res = await http().get('/public/tld-index').expect(200);
    expect(res.headers['cache-control']).toContain('max-age');
    const row = res.body.tlds.find((t: { tld: string }) => t.tld === tld);
    expect(row).toMatchObject({ from: 9, registrars: 2, category: 'Other' });
    expect(typeof row.checkable).toBe('boolean');
    expect(res.body.count).toBe(res.body.tlds.length);
  });

  it('lists the TLD in the catalog with its spread', async () => {
    const res = await http().get('/public/tlds').expect(200);
    const row = res.body.tlds.find((t: { tld: string }) => t.tld === tld);
    expect(row).toMatchObject({
      registrars: 2,
      cheapestRegister: 9,
      cheapestThreeYear: 60,
      threeYearSpread: 9,
    });
    expect(res.body.stats.prices).toBeGreaterThanOrEqual(2);
  });

  it('404s unknown TLDs and rejects junk', async () => {
    await http().get('/public/tlds/zz-none-here').expect(404);
    await http().get('/public/tlds/<script>').expect(400);
  });

  it('redirects Buy to the registrar and counts the click', async () => {
    const res = await http().get(`/out/porkbun?d=acme.${tld}`).expect(302);
    expect(res.headers.location).toBe(
      `https://porkbun.com/checkout/search?q=acme.${tld}`,
    );
    const ovh = await http().get(`/out/ovh?d=acme.${tld}`).expect(302);
    expect(ovh.headers.location).toMatch(
      /^https:\/\/order\.eu\.ovhcloud\.com\/[a-z-]+\/order\/webcloud\/\?#\/webCloud\/domain\/select\?domain=acme\./,
    );
    await new Promise((r) => setTimeout(r, 200)); // click insert is fire-and-forget
    const rows = await db
      .select()
      .from(buyClicks)
      .where(and(eq(buyClicks.tld, tld), like(buyClicks.registrar, 'porkbun')));
    expect(rows).toHaveLength(1);
  });

  it('never redirects to an arbitrary place', async () => {
    await http().get(`/out/evil?d=acme.${tld}`).expect(404);
    await http().get('/out/porkbun?d=https://evil.example/x').expect(400);
    await http().get('/out/porkbun').expect(400);
  });
});
