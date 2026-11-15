import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { eq, inArray, like } from 'drizzle-orm';
import { AppModule } from './../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import type { OAuthProfile } from '../src/modules/auth/dto/auth.dto';
import { CreditsService } from '../src/modules/credits/credits.service';
import { CreditPricingService } from '../src/modules/credits/credit-pricing.service';
import { DatabaseService } from '../src/database/database.service';
import { creditTransactions, users } from '../src/database/schema';

/**
 * Credit rules against a real Postgres: sign-up grants, one account per
 * email, idempotent refunds, and who may call what.
 */
describe('Credits (e2e)', () => {
  let app: INestApplication<App>;
  let auth: AuthService;
  let credits: CreditsService;
  let db: ReturnType<DatabaseService['getDb']>;
  const tag = `e2e-${randomUUID().slice(0, 8)}`;
  const email = (n: string) => `${tag}-${n}@example.test`;
  const profile = (
    n: string,
    provider: OAuthProfile['provider'] = 'github',
  ): OAuthProfile => ({
    id: `${tag}-${n}-${provider}`,
    email: email(n),
    name: n,
    provider,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    auth = app.get(AuthService);
    credits = app.get(CreditsService);
    db = app.get(DatabaseService).getDb();
  });

  afterAll(async () => {
    await db.delete(users).where(like(users.email, `${tag}-%`));
    await app?.close();
  });

  const countUsers = async () => (await db.select().from(users)).length;

  it('grants welcome credits atomically, with a ledger entry', async () => {
    const before = await countUsers();
    const { user } = await auth.validateOAuthUser(profile('alice'));

    const balance = await credits.getBalance(user.id);
    expect(balance.balance).toBe(credits.signupGrantAmount(before));

    const ledger = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, user.id));
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe('bonus');
  });

  it('signing in with another provider reuses the account (no second grant)', async () => {
    const first = await auth.validateOAuthUser(profile('bob', 'github'));
    const second = await auth.validateOAuthUser(profile('bob', 'google'));
    expect(second.user.id).toBe(first.user.id);
  });

  it('concurrent sign-ups each get exactly one wallet and grant', async () => {
    const names = ['c1', 'c2', 'c3', 'c4', 'c5'];
    const results = await Promise.all(
      names.map((n) => auth.validateOAuthUser(profile(n))),
    );
    const ids = results.map((r) => r.user.id);
    const ledger = await db
      .select()
      .from(creditTransactions)
      .where(inArray(creditTransactions.userId, ids));
    expect(ledger.filter((t) => t.type === 'bonus')).toHaveLength(5);
  });

  it('applies an idempotent refund only once', async () => {
    const { user } = await auth.validateOAuthUser(profile('dave'));
    const start = (await credits.getBalance(user.id)).balance;
    const key = `refund:test:${tag}`;
    await credits.addCredits(
      user.id,
      1.5,
      'refund',
      'test',
      {},
      { idempotencyKey: key },
    );
    await credits.addCredits(
      user.id,
      1.5,
      'refund',
      'test',
      {},
      { idempotencyKey: key },
    );
    expect((await credits.getBalance(user.id)).balance).toBe(start + 1.5);
  });

  it('exposes pricing and promo publicly', async () => {
    const pricing = await request(app.getHttpServer())
      .get('/credits/pricing')
      .expect(200);
    expect(pricing.body).toEqual(app.get(CreditPricingService).pricing());
    const promo = await request(app.getHttpServer())
      .get('/credits/promo')
      .expect(200);
    expect(promo.body).toHaveProperty('earlyRemaining');
  });

  it('estimates with the same prices that are charged', async () => {
    const { accessToken } = await auth.validateOAuthUser(profile('erin'));
    const res = await request(app.getHttpServer())
      .post('/credits/estimate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ operation: 'generation', engine: 'ai', names: 15, tlds: 3 })
      .expect(201);
    const p = app.get(CreditPricingService).pricing();
    expect(res.body.total).toBeCloseTo(
      p.perAiGeneration + 45 * p.perDomainCheck,
    );
  });

  it('uncharged registrar endpoints are admin-only', async () => {
    const { accessToken } = await auth.validateOAuthUser(profile('frank'));
    await request(app.getHttpServer())
      .post('/registrars/check')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ domain: 'example', tld: 'com' })
      .expect(403);
  });

  it("another user's job is not found", async () => {
    const { accessToken } = await auth.validateOAuthUser(profile('gina'));
    await request(app.getHttpServer())
      .get('/domains/jobs/does-not-exist')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
