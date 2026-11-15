import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  CheckoutRequest,
  PaymentProvider,
  VerifiedPayment,
} from './payment-provider.interface';

const API = 'https://api.paystack.co';

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

/**
 * Paystack Standard checkout. Amounts are sent in the currency's subunit
 * (kobo / cents). Webhooks are signed with HMAC-SHA512 of the raw body using
 * the secret key, sent as `x-paystack-signature`.
 */
@Injectable()
export class PaystackProvider implements PaymentProvider {
  readonly id = 'paystack';
  private readonly logger = new Logger(PaystackProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get secret(): string {
    return this.config.get<string>('PAYSTACK_SECRET_KEY') ?? '';
  }

  isConfigured(): boolean {
    return this.secret.startsWith('sk_');
  }

  async createCheckout(req: CheckoutRequest): Promise<{ url: string }> {
    const data = await this.call<{ authorization_url: string }>(
      'POST',
      '/transaction/initialize',
      {
        email: req.email,
        amount: Math.round(req.amount * 100),
        currency: req.currency,
        reference: req.reference,
        callback_url: req.callbackUrl,
        metadata: req.metadata,
      },
    );
    return { url: data.authorization_url };
  }

  async verify(reference: string): Promise<VerifiedPayment> {
    const data = await this.call<{
      status: string;
      reference: string;
      amount: number;
      currency: string;
    }>('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
    return PaystackProvider.toVerified(data);
  }

  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, unknown>,
  ): string | null {
    const signature = headers['x-paystack-signature'];
    if (typeof signature !== 'string' || !this.isConfigured()) return null;
    if (!PaystackProvider.validSignature(rawBody, signature, this.secret)) {
      this.logger.warn('Rejected Paystack webhook with a bad signature');
      return null;
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      data?: { reference?: string };
    };
    return event.event === 'charge.success'
      ? (event.data?.reference ?? null)
      : null;
  }

  static validSignature(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): boolean {
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  static toVerified(data: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
  }): VerifiedPayment {
    const status =
      data.status === 'success'
        ? 'success'
        : ['failed', 'abandoned', 'reversed'].includes(data.status)
          ? 'failed'
          : 'pending';
    return {
      reference: data.reference,
      status,
      amount: data.amount / 100,
      currency: data.currency,
    };
  }

  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secret}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as PaystackEnvelope<T>;
    if (!res.ok || !json.status) {
      throw new Error(`Paystack ${path} failed: ${json.message ?? res.status}`);
    }
    return json.data;
  }
}
