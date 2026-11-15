import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PaystackProvider } from '../providers/paystack.provider';
import { CREDIT_PACKS, packPrice } from '../../../config/packs';

const SECRET = 'sk_test_abc123';
const sign = (body: Buffer, secret = SECRET) =>
  createHmac('sha512', secret).update(body).digest('hex');

describe('PaystackProvider', () => {
  const provider = new PaystackProvider(
    new ConfigService({ PAYSTACK_SECRET_KEY: SECRET }),
  );
  const body = Buffer.from(
    JSON.stringify({ event: 'charge.success', data: { reference: 'dq_1' } }),
  );

  it('accepts a correctly signed charge.success and returns its reference', () => {
    expect(
      provider.parseWebhook(body, { 'x-paystack-signature': sign(body) }),
    ).toBe('dq_1');
  });

  it('rejects a bad or missing signature', () => {
    expect(
      provider.parseWebhook(body, {
        'x-paystack-signature': sign(body, 'sk_test_wrong'),
      }),
    ).toBeNull();
    expect(provider.parseWebhook(body, {})).toBeNull();
  });

  it('ignores events other than charge.success', () => {
    const other = Buffer.from(JSON.stringify({ event: 'transfer.success' }));
    expect(
      provider.parseWebhook(other, { 'x-paystack-signature': sign(other) }),
    ).toBeNull();
  });

  it('converts subunits and maps statuses', () => {
    expect(
      PaystackProvider.toVerified({
        status: 'success',
        reference: 'r',
        amount: 500,
        currency: 'USD',
      }),
    ).toEqual({
      reference: 'r',
      status: 'success',
      amount: 5,
      currency: 'USD',
    });
    expect(
      PaystackProvider.toVerified({
        status: 'abandoned',
        reference: 'r',
        amount: 0,
        currency: 'USD',
      }).status,
    ).toBe('failed');
    expect(
      PaystackProvider.toVerified({
        status: 'ongoing',
        reference: 'r',
        amount: 0,
        currency: 'USD',
      }).status,
    ).toBe('pending');
  });
});

describe('packPrice', () => {
  const standard = CREDIT_PACKS.find((p) => p.id === 'standard')!;
  it('charges USD as listed', () => {
    expect(packPrice(standard, 'USD', 1600)).toBe(5);
  });
  it('converts to NGN and rounds up to ₦100', () => {
    expect(packPrice(standard, 'NGN', 1555)).toBe(7800);
  });
});
