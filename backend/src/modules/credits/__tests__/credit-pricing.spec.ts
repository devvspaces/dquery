import { CreditPricingService } from '../credit-pricing.service';
import { CreditsService } from '../credits.service';
import { LAUNCH_PRICING, settingsStub } from '../../settings/testing';

describe('CreditPricingService', () => {
  const pricing = new CreditPricingService(settingsStub(LAUNCH_PRICING));

  it('charges per name × TLD, never per registrar', () => {
    expect(pricing.quoteGeneration('ai', 15, 3)).toEqual({
      generation: 1,
      checks: 45,
      checking: 2.25,
      total: 3.25,
    });
  });

  it('makes the word engine cheaper than AI', () => {
    expect(pricing.quoteGeneration('words', 15, 3).total).toBe(2.5);
  });

  it('prices plain checks without a generation fee', () => {
    expect(pricing.quoteChecks(8)).toEqual({
      generation: 0,
      checks: 8,
      checking: 0.4,
      total: 0.4,
    });
  });

  it('follows the current settings', () => {
    const custom = new CreditPricingService(
      settingsStub({
        ...LAUNCH_PRICING,
        'credits.perAiGeneration': 2,
        'credits.perDomainCheck': 0.1,
      }),
    );
    expect(custom.quoteGeneration('ai', 10, 1).total).toBe(3);
  });
});

describe('CreditsService.signupGrantAmount', () => {
  const settings = settingsStub(LAUNCH_PRICING);
  const service = new CreditsService(
    {} as never,
    {} as never,
    new CreditPricingService(settings),
    settings,
  );

  it('gives the early amount to the first 500 users, then the default', () => {
    expect(service.signupGrantAmount(0)).toBe(10);
    expect(service.signupGrantAmount(499)).toBe(10); // the 500th user
    expect(service.signupGrantAmount(500)).toBe(5); // the 501st user
  });
});
