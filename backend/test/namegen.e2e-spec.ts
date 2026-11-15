import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { like } from 'drizzle-orm';
import { AppModule } from './../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { CreditsService } from '../src/modules/credits/credits.service';
import { CreditPricingService } from '../src/modules/credits/credit-pricing.service';
import { DatabaseService } from '../src/database/database.service';
import { users } from '../src/database/schema';

/** The word engine end to end: preview, rate limit, and a charged generation run. */
describe('Word engine (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<DatabaseService['getDb']>;
  const tag = `e2e-ng-${randomUUID().slice(0, 8)}`;

  const signIn = async (n: string) =>
    app.get(AuthService).validateOAuthUser({
      id: `${tag}-${n}`,
      email: `${tag}-${n}@example.test`,
      name: n,
      provider: 'github',
    });

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
  });

  afterAll(async () => {
    await db.delete(users).where(like(users.email, `${tag}%`));
    await app?.close();
  });

  it('previews names for the signed-in user', async () => {
    const { accessToken } = await signIn('preview');
    const res = await request(app.getHttpServer())
      .post('/namegen/preview')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ seeds: ['ledger'], strategies: ['affix', 'blend'], count: 12 })
      .expect(200);
    expect(res.body.names).toHaveLength(12);
    expect(res.body.names[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        technique: expect.any(String),
      }),
    );
  });

  it('rejects invalid patterns', async () => {
    const { accessToken } = await signIn('invalid');
    await request(app.getHttpServer())
      .post('/namegen/preview')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ seeds: ['x'], patterns: ['CXV'] })
      .expect(400);
  });

  it('rate-limits previews per user (30 a minute)', async () => {
    const { accessToken } = await signIn('spammer');
    const send = () =>
      request(app.getHttpServer())
        .post('/namegen/preview')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ seeds: ['a1'], strategies: ['coin'], count: 1 });
    for (let i = 0; i < 30; i++) await send().expect(200);
    await send().expect(429);

    // A different user is unaffected.
    const other = await signIn('neighbour');
    await request(app.getHttpServer())
      .post('/namegen/preview')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ seeds: ['b2'], strategies: ['coin'], count: 1 })
      .expect(200);
  });

  it('runs a charged word-engine generation through the queue', async () => {
    const { accessToken, user } = await signIn('generator');
    const before = (await app.get(CreditsService).getBalance(user.id)).balance;
    const res = await request(app.getHttpServer())
      .post('/domains/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        engine: 'words',
        wordEngine: { seeds: ['ledger'], strategies: ['affix'] },
        count: 10,
        tlds: ['com'],
      })
      .expect(201);

    const expected = app
      .get(CreditPricingService)
      .quoteGeneration('words', 10, 1).total;
    expect(res.body.creditsDeducted).toBe(expected);
    expect(
      (await app.get(CreditsService).getBalance(user.id)).balance,
    ).toBeCloseTo(before - expected);

    let job: {
      status: string;
      result?: { domains: string[]; provider: string };
    } = {
      status: 'waiting',
    };
    for (let i = 0; i < 40 && job.status !== 'completed'; i++) {
      await new Promise((r) => setTimeout(r, 250));
      job = (
        await request(app.getHttpServer())
          .get(`/domains/jobs/${res.body.jobId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
      ).body;
    }
    expect(job.status).toBe('completed');
    expect(job.result!.provider).toBe('word-engine');
    expect(job.result!.domains).toHaveLength(10);
  });

  it('still requires businessName for AI generation', async () => {
    const { accessToken } = await signIn('ai');
    await request(app.getHttpServer())
      .post('/domains/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ count: 10, tlds: ['com'] })
      .expect(400);
  });
});
