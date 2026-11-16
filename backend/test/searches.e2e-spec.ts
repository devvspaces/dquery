import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { eq, like } from 'drizzle-orm';
import { AppModule } from './../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { CreditsService } from '../src/modules/credits/credits.service';
import { CreditPricingService } from '../src/modules/credits/credit-pricing.service';
import { DatabaseService } from '../src/database/database.service';
import { searchResults, tldPrices, users } from '../src/database/schema';
import { TldPricesService } from '../src/modules/registrars/tld-prices.service';
import { RegistrarsService } from '../src/modules/registrars/registrars.service';
import { saveSearchResults } from '../src/modules/domains/search-store';

/** Saved searches: stored automatically, reopened free, refreshed for credits. */
describe('Saved searches (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<DatabaseService['getDb']>;
  const tag = `e2e-ss-${randomUUID().slice(0, 8)}`;
  const tld = `e2s${Date.now().toString(36)}`;
  let token: string;
  let userId: string;
  let otherToken: string;
  let searchId: string;
  let registrarId: string;
  let registrarName: string;
  const http = () => request(app.getHttpServer());
  const as = (r: request.Test, t = token) =>
    r.set('Authorization', `Bearer ${t}`);
  const balance = async () =>
    (await app.get(CreditsService).getBalance(userId)).balance;

  const signIn = (n: string) =>
    app.get(AuthService).validateOAuthUser({
      id: `${tag}-${n}`,
      email: `${tag}-${n}@example.test`,
      name: n,
      provider: 'github',
    });

  /** Poll until `check` passes (jobs run on the queue in the background). */
  const eventually = async <T>(
    get: () => Promise<T>,
    check: (v: T) => boolean,
  ) => {
    let v = await get();
    for (let i = 0; i < 80 && !check(v); i++) {
      await new Promise((r) => setTimeout(r, 250));
      v = await get();
    }
    expect(check(v)).toBe(true);
    return v;
  };
  const listSearches = async () =>
    (await as(http().get('/searches?limit=50'))).body.data as Array<{
      id: string;
      kind: string;
      names: number;
    }>;
  const getSearch = async (id: string) =>
    (await as(http().get(`/searches/${id}`))).body as {
      names: string[];
      kind: string;
      tlds: string[];
      input: { engine: string };
      results: unknown[];
    };

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

    const me = await signIn('owner');
    token = me.accessToken;
    userId = me.user.id;
    await app.get(CreditsService).addCredits(userId, 50, 'bonus', 'e2e top-up');
    otherToken = (await signIn('other')).accessToken;

    const enabled = app
      .get(RegistrarsService)
      .describeProviders()
      .filter((p) => p.enabled)[0];
    registrarId = enabled.id;
    registrarName = enabled.name;
  }, 30_000);

  afterAll(async () => {
    await db.delete(tldPrices).where(eq(tldPrices.tld, tld));
    await db.delete(users).where(like(users.email, `${tag}%`));
    await app?.close();
  }, 30_000);

  it('stores a generation with its names and input', async () => {
    const res = await as(http().post('/domains/generate'))
      .send({
        engine: 'words',
        autoCheck: false,
        wordEngine: { seeds: ['harbor'], strategies: ['affix', 'blend'] },
        count: 20,
        tlds: ['com', tld],
      })
      .expect(201);
    expect(res.body.jobId).toBeTruthy();
    const list = await eventually(listSearches, (l) =>
      l.some((x) => x.kind === 'generate' && x.names > 0),
    );
    searchId = list.find((x) => x.kind === 'generate')!.id;

    const saved = await getSearch(searchId);
    expect(saved).toMatchObject({ kind: 'generate', tlds: ['com', tld] });
    expect(saved.names.length).toBeGreaterThan(0);
    expect(new Set(saved.names).size).toBe(saved.names.length);
    expect(saved.input.engine).toBe('words');
    expect(saved.results).toEqual([]);
  }, 30_000);

  it('keeps searches private', async () => {
    await as(http().get(`/searches/${searchId}`), otherToken).expect(404);
    await as(http().post('/domains/check/bulk'), otherToken)
      .send({ domains: [{ domain: 'x', tld: 'com' }], searchId })
      .expect(404);
  });

  it('stores a bulk check on the search it came from, merging new names', async () => {
    const before = await balance();
    const res = await as(http().post('/domains/check/bulk'))
      .send({ domains: [{ domain: 'myownname', tld }], searchId })
      .expect(201);
    expect(res.body.searchId).toBe(searchId);
    expect(await balance()).toBeCloseTo(before - 0.05);
    const saved = (await as(http().get(`/searches/${searchId}`))).body;
    expect(saved.names).toContain('myownname');
  });

  it('creates a "check" search for a standalone check', async () => {
    const res = await as(http().post('/domains/check/bulk'))
      .send({ domains: [{ domain: 'solo', tld }], title: 'solo.com' })
      .expect(201);
    expect(res.body.searchId).not.toBe(searchId);
    const saved = (await as(http().get(`/searches/${res.body.searchId}`))).body;
    expect(saved).toMatchObject({
      kind: 'check',
      title: 'solo.com',
      names: ['solo'],
    });
  });

  it('refreshes prices from the catalog, charging only available domains, once', async () => {
    const offer = (status: string, price?: number) => ({
      domain: 'alpha',
      tld,
      available: status === 'available',
      status,
      registrar: registrarName,
      price,
      renewalPrice: price,
      currency: 'USD',
      priceSource: 'catalog-api',
      checkedAt: new Date(),
    });
    await saveSearchResults(db, searchId, [
      {
        domain: 'alpha',
        tld,
        results: [offer('available', 99) as never],
        availableCount: 1,
        bestPrice: 99,
        bestRegistrar: registrarName,
        checkedAt: new Date(),
      },
      {
        domain: 'beta',
        tld,
        results: [{ ...offer('taken'), domain: 'beta' } as never],
        availableCount: 0,
        bestPrice: null,
        bestRegistrar: null,
        checkedAt: new Date(),
      },
    ]);
    await app.get(TldPricesService).setTldPrice(registrarId, tld, 7, 9);

    const requestId = randomUUID();
    const before = await balance();
    const res = await as(http().post(`/searches/${searchId}/refresh`))
      .send({ mode: 'prices', requestId })
      .expect(201);
    const fee = app.get(CreditPricingService).pricing().perPriceRefresh;
    expect(res.body).toMatchObject({
      mode: 'prices',
      repriced: 1,
      creditsDeducted: fee,
    });
    expect(res.body.results[0].bestPrice).toBe(7);
    expect(await balance()).toBeCloseTo(before - fee);

    const again = await as(http().post(`/searches/${searchId}/refresh`))
      .send({ mode: 'prices', requestId })
      .expect(201);
    expect(again.body).toMatchObject({ duplicate: true, creditsDeducted: 0 });

    const summary = (await as(http().get('/searches?limit=50'))).body.data.find(
      (x: { id: string }) => x.id === searchId,
    );
    expect(summary).toMatchObject({ available: 1, cheapest: 7 });
    expect(await balance()).toBeCloseTo(before - fee);
  });

  it('re-checks availability for chosen domains at the check price, once', async () => {
    const requestId = randomUUID();
    const before = await balance();
    const res = await as(http().post(`/searches/${searchId}/refresh`))
      .send({
        mode: 'availability',
        requestId,
        pairs: [
          { domain: 'alpha', tld },
          { domain: 'beta', tld },
        ],
      })
      .expect(201);
    expect(res.body).toMatchObject({
      mode: 'availability',
      domains: 2,
      creditsDeducted: 0.1,
    });
    expect(res.body.sseUrl).toContain(res.body.batchId);
    expect(await balance()).toBeCloseTo(before - 0.1);

    const again = await as(http().post(`/searches/${searchId}/refresh`))
      .send({ mode: 'availability', requestId })
      .expect(201);
    expect(again.body).toMatchObject({
      duplicate: true,
      batchId: res.body.batchId,
    });
    expect(await balance()).toBeCloseTo(before - 0.1);
  });

  it('makes more names without repeating, for the generation fee', async () => {
    const names = (await as(http().get(`/searches/${searchId}`))).body
      .names as string[];
    const before = await balance();
    const res = await as(http().post(`/searches/${searchId}/names`))
      .send({ requestId: randomUUID() })
      .expect(201);
    expect(res.body.creditsDeducted).toBe(0.25);
    const after = (
      await eventually(
        () => getSearch(searchId),
        (x) => x.names.length > names.length,
      )
    ).names;
    expect(after.length).toBeGreaterThan(names.length);
    expect(new Set(after).size).toBe(after.length);
    expect(after.slice(0, names.length)).toEqual(names);
    expect(await balance()).toBeCloseTo(before - 0.25);
  }, 30_000);

  it('lists, pins, renames and deletes', async () => {
    await as(http().patch(`/searches/${searchId}`))
      .send({ title: 'Harbor ideas', pinned: true })
      .expect(200);
    const list = (await as(http().get('/searches?limit=10')).expect(200)).body;
    expect(list.data[0]).toMatchObject({
      id: searchId,
      title: 'Harbor ideas',
      pinned: true,
    });
    expect(list.data[0].checked).toBeGreaterThanOrEqual(2);
    expect(list.meta.total).toBeGreaterThanOrEqual(2);

    await as(http().delete(`/searches/${searchId}`)).expect(200);
    await as(http().get(`/searches/${searchId}`)).expect(404);
    const rows = await db
      .select()
      .from(searchResults)
      .where(eq(searchResults.searchId, searchId));
    expect(rows).toHaveLength(0);
  });
});
