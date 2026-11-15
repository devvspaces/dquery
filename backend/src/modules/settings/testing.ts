import { SETTINGS_BY_KEY } from './settings.registry';
import type { SettingsService } from './settings.service';

/**
 * A SettingsService stand-in for unit tests: registry defaults plus overrides.
 * (Defaults read .env, so tests that need exact numbers should pass overrides.)
 */
export function settingsStub(
  overrides: Record<string, unknown> = {},
): SettingsService {
  return {
    get: (key: string) => {
      if (key in overrides) return overrides[key];
      const def = SETTINGS_BY_KEY.get(key);
      if (!def) throw new Error(`Unknown setting ${key}`);
      return def.envDefault();
    },
    onChange: () => undefined,
  } as unknown as SettingsService;
}

/** The launch pricing, for tests that assert exact amounts. */
export const LAUNCH_PRICING = {
  'credits.perAiGeneration': 1,
  'credits.perWordGeneration': 0.25,
  'credits.perDomainCheck': 0.05,
  'credits.freeEarly': 10,
  'credits.freeEarlyLimit': 500,
  'credits.freeDefault': 5,
};
