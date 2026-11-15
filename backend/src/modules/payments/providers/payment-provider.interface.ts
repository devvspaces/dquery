export interface CheckoutRequest {
  reference: string;
  email: string;
  /** Major units, e.g. 5 (USD) or 8000 (NGN). */
  amount: number;
  currency: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface VerifiedPayment {
  reference: string;
  /** Only 'success' credits the user. */
  status: 'success' | 'pending' | 'failed';
  amount: number;
  currency: string;
}

/** A payment gateway. Paystack today; a merchant of record (Polar) can be added later. */
export interface PaymentProvider {
  readonly id: string;
  isConfigured(): boolean;
  createCheckout(req: CheckoutRequest): Promise<{ url: string }>;
  /** Ask the provider for the authoritative state of a payment. */
  verify(reference: string): Promise<VerifiedPayment>;
  /** Check a webhook's signature; returns the payment reference it concerns, or null to ignore it. */
  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, unknown>,
  ): string | null;
}
