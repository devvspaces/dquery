import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { eq, like } from 'drizzle-orm';
import { AppModule } from './../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { CreditsService } from '../src/modules/credits/credits.service';
import { DatabaseService } from '../src/database/database.service';
import { purchases, users } from '../src/database/schema';
import { PaystackProvider } from '../src/modules/payments/providers/paystack.provider';
import type { VerifiedPayment } from '../src/modules/payments/providers/payment-provider.interface';

/**
 * Purchase flow against a real Postgres with Paystack replaced by a fake:
 * checkout → webhook → credits added exactly once.
 */
describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let credits: CreditsService;
  let db: ReturnType<DatabaseService['getDb']>;
  let token: string;
  let userId: string;
  const tag = `e2e-pay-${randomUUID().slice(0, 8)}`;

  // What the fake gateway reports for the next verify() call.
  let verification: Partial<VerifiedPayment> = {};
  const fakePaystack = {
    id: 'paystack',
    isConfigured: () => true,
    createCheckout: jest.fn(async () => ({ url: 'https://checkout.test/x' })),
    verify: jest.fn(async (reference: string) => ({
      reference,
      status: 'success',
      amount: 5,
      currency: 'USD',
      ...verification,
    })),
    // Signature checks are unit-tested; the fake just reads the reference.
    parseWebhook: (raw: Buffer) =>
      (JSON.parse(raw.toString('utf8')) as { data: { reference: string } }).data
        .reference,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaystackProvider)
      .useValue(fakePaystack)
      .compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    credits = app.get(CreditsService);
    db = app.get(DatabaseService).getDb();
    const auth = await app.get(AuthService).validateOAuthUser({
      id: tag,
      email: `${tag}@example.test`,
      name: 'Payer',
      provider: 'github',
    });
    token = auth.accessToken;
    userId = auth.user.id;
  });

  afterAll(async () => {
    await db.delete(users).where(like(users.email, `${tag}%`));
    await app?.close();
  });

  const checkout = async (packId = 'standard') => {
    const res = await request(app.getHttpServer())
      .post('/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packId })
      .expect(201);
    return res.body as { url: string; reference: string };
  };

  const webhook = (reference: string) =>
    request(app.getHttpServer())
      .post('/payments/paystack/webhook')
      .send({ event: 'charge.success', data: { reference } })
      .expect(200);

  it('lists packs publicly', async () => {
    const res = await request(app.getHttpServer())
      .get('/credits/packs')
      .expect(200);
    expect(res.body.map((p: { id: string }) => p.id)).toContain('standard');
  });

  it('credits a paid checkout exactly once, even when the webhook repeats', async () => {
    verification = {};
    const before = (await credits.getBalance(userId)).balance;
    const { url, reference } = await checkout();
    expect(url).toBe('https://checkout.test/x');

    await webhook(reference);
    await webhook(reference);
    // Credited by the webhook alone, before any status poll.
    expect((await credits.getBalance(userId)).balance).toBe(before + 50);
    const status = await request(app.getHttpServer())
      .get(`/payments/${reference}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(status.body.status).toBe('completed');
    expect((await credits.getBalance(userId)).balance).toBe(before + 50);
  });

  it('refuses to credit when the paid amount does not match', async () => {
    verification = { amount: 1 };
    const before = (await credits.getBalance(userId)).balance;
    const { reference } = await checkout();
    await webhook(reference);

    const [row] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.providerReference, reference));
    expect(row.status).toBe('failed');
    expect((await credits.getBalance(userId)).balance).toBe(before);
  });

  it("hides other users' payments", async () => {
    verification = {};
    const { reference } = await checkout();
    const other = await app.get(AuthService).validateOAuthUser({
      id: `${tag}-other`,
      email: `${tag}-other@example.test`,
      name: 'Other',
      provider: 'github',
    });
    await request(app.getHttpServer())
      .get(`/payments/${reference}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(404);
  });

  it('rejects unknown packs', async () => {
    await request(app.getHttpServer())
      .post('/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packId: 'free-money' })
      .expect(400);
  });
});
