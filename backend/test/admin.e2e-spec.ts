import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { eq, inArray, like } from 'drizzle-orm';
import { AppModule } from './../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { DatabaseService } from '../src/database/database.service';
import {
  adminAuditLog,
  appSettings,
  creditTransactions,
  priceSyncRuns,
  tldPrices,
  users,
} from '../src/database/schema';
import { TldPricesService } from '../src/modules/registrars/tld-prices.service';

/** The admin API: access control, settings, credits, suspension, prices. */
describe('Admin (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<DatabaseService['getDb']>;
  const tag = `e2e-adm-${randomUUID().slice(0, 8)}`;
  const adminEmail = `${tag}-admin@example.test`;
  let adminToken: string;
  let userToken: string;
  let userId: string;
  const http = () => request(app.getHttpServer());

  const signIn = (n: string, email = `${tag}-${n}@example.test`) =>
    app.get(AuthService).validateOAuthUser({
      id: `${tag}-${n}`,
      email,
      name: n,
      provider: 'github',
    });

  beforeAll(async () => {
    process.env.ADMIN_EMAILS = adminEmail;
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
    adminToken = (await signIn('admin', adminEmail)).accessToken;
    const user = await signIn('user');
    userToken = user.accessToken;
    userId = user.user.id;
  });

  afterAll(async () => {
    await db
      .delete(appSettings)
      .where(
        inArray(appSettings.key, [
          'credits.perDomainCheck',
          'credits.freeDefault',
        ]),
      );
    await db
      .delete(adminAuditLog)
      .where(eq(adminAuditLog.adminEmail, adminEmail));
    await db.delete(tldPrices).where(eq(tldPrices.registrar, 'e2etest'));
    await db.delete(users).where(like(users.email, `${tag}%`));
    delete process.env.ADMIN_EMAILS;
    await app?.close();
  });

  const admin = (r: request.Test) =>
    r.set('Authorization', `Bearer ${adminToken}`);

  it('tells the frontend who is an admin', async () => {
    expect((await admin(http().get('/auth/me'))).body.isAdmin).toBe(true);
    const me = await http()
      .get('/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(me.body.isAdmin).toBe(false);
  });

  it('refuses non-admins on every admin route', async () => {
    for (const path of [
      '/admin/metrics/summary',
      '/admin/users',
      '/admin/settings',
      '/admin/registrars',
      '/admin/ops/queues',
      '/admin/payments',
      '/admin/audit',
    ]) {
      await http()
        .get(path)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
      await http().get(path).expect(401);
    }
  });

  it('serves the dashboard, users, registrars, queues and payments', async () => {
    const summary = await admin(
      http().get('/admin/metrics/summary?days=7'),
    ).expect(200);
    expect(summary.body.series).toHaveLength(7);
    expect(summary.body.totals.users).toBeGreaterThanOrEqual(2);
    expect(summary.body.series[6].signups).toBeGreaterThanOrEqual(2);

    const list = await admin(http().get(`/admin/users?q=${tag}`)).expect(200);
    expect(list.body.total).toBe(2);

    const regs = await admin(http().get('/admin/registrars')).expect(200);
    expect(regs.body.map((r: { id: string }) => r.id)).toEqual(
      expect.arrayContaining(['porkbun', 'ovh', 'truehost']),
    );

    await admin(http().get('/admin/ops/queues')).expect(200);
    await admin(http().get('/admin/payments')).expect(200);
    await admin(http().get('/admin/metrics/llm')).expect(200);
    await admin(http().get('/admin/fx')).expect(200);
  });

  it('changes a setting live, validates it, and resets to the .env default', async () => {
    const before = (await http().get('/credits/pricing')).body.perDomainCheck;
    await admin(http().put('/admin/settings/credits.perDomainCheck'))
      .send({ value: 0.07 })
      .expect(200);
    expect((await http().get('/credits/pricing')).body.perDomainCheck).toBe(
      0.07,
    );

    const bad = await admin(
      http().put('/admin/settings/credits.perDomainCheck'),
    )
      .send({ value: -1 })
      .expect(400);
    expect(bad.body.message).toContain('≥ 0');
    await admin(http().put('/admin/settings/nope.unknown'))
      .send({ value: 1 })
      .expect(404);

    const reset = await admin(
      http().delete('/admin/settings/credits.perDomainCheck'),
    ).expect(200);
    expect(reset.body.source).toBe('env');
    expect((await http().get('/credits/pricing')).body.perDomainCheck).toBe(
      before,
    );

    const audit = await admin(http().get('/admin/audit')).expect(200);
    expect(audit.body.map((a: { action: string }) => a.action)).toEqual(
      expect.arrayContaining(['settings.update', 'settings.reset']),
    );
  });

  it('applies the sign-up grant setting to new users', async () => {
    await admin(http().put('/admin/settings/credits.freeDefault'))
      .send({ value: 7 })
      .expect(200);
    await admin(http().put('/admin/settings/credits.freeEarly'))
      .send({ value: 7 })
      .expect(200);
    const fresh = await signIn('fresh');
    const me = await http()
      .get('/credits/balance')
      .set('Authorization', `Bearer ${fresh.accessToken}`);
    expect(me.body.balance).toBe(7);
    await admin(http().delete('/admin/settings/credits.freeEarly')).expect(200);
  });

  it('adjusts credits once per request id, both ways', async () => {
    const start = (await admin(http().get(`/admin/users/${userId}`))).body
      .wallet.balance;
    const requestId = randomUUID();
    const body = { delta: 5, reason: 'support goodwill', requestId };
    await admin(http().post(`/admin/users/${userId}/credits`))
      .send(body)
      .expect(201);
    await admin(http().post(`/admin/users/${userId}/credits`))
      .send(body)
      .expect(201);
    await admin(http().post(`/admin/users/${userId}/credits`))
      .send({ delta: -2, reason: 'correction', requestId: randomUUID() })
      .expect(201);
    const detail = (await admin(http().get(`/admin/users/${userId}`))).body;
    expect(detail.wallet.balance).toBe(start + 3);
    const adminRows = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));
    expect(
      adminRows.filter((t) => t.description.startsWith('Admin adjustment')),
    ).toHaveLength(2);
  });

  it('suspends and restores a user', async () => {
    await admin(http().post(`/admin/users/${userId}/suspend`))
      .send({ reason: 'abuse' })
      .expect(201);
    await http()
      .get('/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
    await http()
      .post('/domains/check/bulk')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ domains: [{ domain: 'x', tld: 'com' }] })
      .expect(403);
    await admin(http().post(`/admin/users/${userId}/unsuspend`)).expect(201);
    await http()
      .get('/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const self = (await admin(http().get(`/admin/users?q=${tag}-admin`))).body
      .data[0];
    await admin(http().post(`/admin/users/${self.id}/suspend`))
      .send({})
      .expect(400);
  });

  it('sets and removes a manual price', async () => {
    await admin(http().put('/admin/prices'))
      .send({ registrar: 'e2etest', tld: 'com', register: 4.2, renew: 9.9 })
      .expect(200);
    const list = await admin(
      http().get('/admin/prices?registrar=e2etest'),
    ).expect(200);
    expect(list.body.data[0]).toEqual(
      expect.objectContaining({
        tld: 'com',
        registerPrice: 4.2,
        source: 'manual',
      }),
    );
    await admin(http().delete('/admin/prices/e2etest/com')).expect(200);
    await admin(http().delete('/admin/prices/e2etest/com')).expect(404);
  });

  it('records price-sync runs', async () => {
    const before = (await db.select().from(priceSyncRuns)).length;
    // Run a sync for an id that has no provider: nothing to fetch, nothing recorded.
    await app.get(TldPricesService).syncAllPrices(['porkbun-does-not-exist']);
    expect((await db.select().from(priceSyncRuns)).length).toBe(before);
    // Queue a sync for an id with no provider so CI makes no external calls.
    const queued = await admin(http().post('/admin/registrars/sync'))
      .send({ registrars: ['e2e-none'] })
      .expect(201);
    expect(queued.body.jobId).toBeTruthy();
  });
});
