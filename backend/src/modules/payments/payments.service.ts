import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { purchases, type Purchase } from '../../database/schema';
import { CreditsService } from '../credits/credits.service';
import { CREDIT_PACKS, findPack, packPrice } from '../../config/packs';
import { PaystackProvider } from './providers/paystack.provider';
import { SettingsService } from '../settings/settings.service';

export interface PackView {
  id: string;
  label: string;
  credits: number;
  price: number;
  currency: string;
  popular: boolean;
}

export interface PurchaseView {
  reference: string;
  status: string;
  credits: number;
  amount: number;
  currency: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly credits: CreditsService,
    private readonly paystack: PaystackProvider,
    private readonly settings: SettingsService,
  ) {}

  private get currency(): string {
    return this.settings.get<string>('payments.currency');
  }

  private get ngnPerUsd(): number {
    return this.settings.get<number>('payments.ngnPerUsd');
  }

  listPacks(): PackView[] {
    return CREDIT_PACKS.map((p) => ({
      id: p.id,
      label: p.label,
      credits: p.credits,
      price: packPrice(p, this.currency, this.ngnPerUsd),
      currency: this.currency,
      popular: !!p.popular,
    }));
  }

  /** Create a pending purchase and a hosted checkout page for it. */
  async createCheckout(
    user: { id: string; email: string },
    packId: string,
  ): Promise<{ url: string; reference: string }> {
    const pack = findPack(packId);
    if (!pack) throw new BadRequestException(`Unknown pack ${packId}`);
    if (!this.paystack.isConfigured()) {
      throw new ServiceUnavailableException('Payments are not configured yet');
    }

    const amount = packPrice(pack, this.currency, this.ngnPerUsd);
    const reference = `dq_${randomUUID().replace(/-/g, '')}`;
    const frontend = this.config.get<string>('app.frontendUrl');

    await this.db
      .getDb()
      .insert(purchases)
      .values({
        userId: user.id,
        amountUsd: pack.usd.toFixed(2),
        creditsPurchased: pack.credits.toFixed(2),
        paymentMethod: 'card',
        status: 'pending',
        provider: this.paystack.id,
        providerReference: reference,
        packId: pack.id,
        amount: amount.toFixed(2),
        currency: this.currency,
      });

    const { url } = await this.paystack.createCheckout({
      reference,
      email: user.email,
      amount,
      currency: this.currency,
      callbackUrl: `${frontend}/payment/callback`,
      metadata: { userId: user.id, packId: pack.id },
    });

    this.logger.log(`Checkout ${reference}: ${pack.id} for user ${user.id}`);
    return { url, reference };
  }

  /** Webhook entry point. Returns quietly for events we ignore. */
  async handleWebhook(
    rawBody: Buffer | undefined,
    headers: Record<string, unknown>,
  ): Promise<void> {
    if (!rawBody) return;
    const reference = this.paystack.parseWebhook(rawBody, headers);
    if (reference) await this.fulfil(reference);
  }

  /** The user's view of a purchase. Re-checks with the provider while pending. */
  async getPurchase(userId: string, reference: string): Promise<PurchaseView> {
    let purchase = await this.find(reference);
    if (!purchase || purchase.userId !== userId) {
      throw new NotFoundException('Payment not found');
    }
    if (purchase.status === 'pending') {
      purchase = (await this.fulfil(reference)) ?? purchase;
    }
    return {
      reference,
      status: purchase.status,
      credits: parseFloat(purchase.creditsPurchased),
      amount: parseFloat(purchase.amount ?? purchase.amountUsd),
      currency: purchase.currency ?? 'USD',
    };
  }

  /**
   * Verify a payment with the provider and credit it exactly once.
   * Safe to call any number of times (webhook retries, callback polling):
   * the credit grant is keyed by the reference.
   */
  async fulfil(reference: string): Promise<Purchase | undefined> {
    const purchase = await this.find(reference);
    if (!purchase) {
      this.logger.warn(`Payment ${reference} has no matching purchase`);
      return undefined;
    }
    if (purchase.status === 'completed') return purchase;

    const verified = await this.paystack.verify(reference);
    if (verified.status === 'pending') return purchase;

    const expected = parseFloat(purchase.amount ?? purchase.amountUsd);
    const matches =
      verified.status === 'success' &&
      verified.currency === purchase.currency &&
      Math.abs(verified.amount - expected) < 0.005;

    if (!matches) {
      this.logger.error(
        `Payment ${reference} not credited: status=${verified.status} amount=${verified.amount} ${verified.currency}, expected ${expected} ${purchase.currency}`,
      );
      return this.setStatus(purchase.id, 'failed');
    }

    await this.credits.addCredits(
      purchase.userId,
      parseFloat(purchase.creditsPurchased),
      'purchase',
      `Bought ${purchase.packId} pack (${purchase.creditsPurchased} credits)`,
      { reference, provider: purchase.provider },
      { idempotencyKey: `purchase:${purchase.provider}:${reference}` },
    );
    this.logger.log(`Payment ${reference} credited to user ${purchase.userId}`);
    return this.setStatus(purchase.id, 'completed');
  }

  private async find(reference: string): Promise<Purchase | undefined> {
    const [row] = await this.db
      .getDb()
      .select()
      .from(purchases)
      .where(eq(purchases.providerReference, reference))
      .limit(1);
    return row;
  }

  private async setStatus(
    id: string,
    status: 'completed' | 'failed',
  ): Promise<Purchase | undefined> {
    const [row] = await this.db
      .getDb()
      .update(purchases)
      .set({ status, completedAt: new Date() })
      .where(and(eq(purchases.id, id), eq(purchases.status, 'pending')))
      .returning();
    return (
      row ??
      (
        await this.db
          .getDb()
          .select()
          .from(purchases)
          .where(eq(purchases.id, id))
      )[0]
    );
  }
}
