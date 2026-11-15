import { registerAs } from '@nestjs/config';

const num = (value: string | undefined, fallback: number) => {
  const parsed = parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Credit prices and the sign-up grant. Every value can be overridden in .env.
 * Prices are applied by CreditPricingService; nothing else should read these.
 */
export default registerAs('credits', () => ({
  /** One AI (LLM) name-generation run. */
  perAiGeneration: num(process.env.CREDIT_PER_AI_GENERATION, 1),
  /** One rule-based word-engine run. */
  perWordGeneration: num(process.env.CREDIT_PER_WORD_GENERATION, 0.25),
  /** Each name × TLD checked; includes the full registrar price comparison. */
  perDomainCheck: num(process.env.CREDIT_PER_DOMAIN_CHECK, 0.05),

  /** Sign-up grant: the first `freeEarlyLimit` users get `freeEarly`, then `freeDefault`. */
  freeDefault: num(process.env.FREE_CREDITS_DEFAULT, 5),
  freeEarly: num(process.env.FREE_CREDITS_EARLY, 10),
  freeEarlyLimit: num(process.env.FREE_CREDITS_EARLY_LIMIT, 500),
}));
