/**
 * Every setting an admin can change at runtime. The value in `app_settings`
 * wins; otherwise the default (usually from .env) applies. Secrets (API keys)
 * are deliberately NOT here — they stay in .env.
 */
export type SettingType =
  | 'number'
  | 'int'
  | 'string'
  | 'enum'
  | 'list'
  | 'record';

export interface SettingDef {
  key: string;
  group: 'Credits' | 'Registrars' | 'Prices' | 'AI' | 'Payments';
  label: string;
  description: string;
  type: SettingType;
  /** Default when no DB override exists. Evaluated on read, so .env changes apply. */
  envDefault: () => unknown;
  /** Name of the env var the default comes from, for display. */
  envVar?: string;
  min?: number;
  max?: number;
  /** Allowed values (enum) or allowed items (list). */
  options?: readonly string[];
  pattern?: RegExp;
  patternHint?: string;
}

const num = (name: string, fallback: number) => {
  const v = parseFloat(process.env[name] ?? '');
  return Number.isFinite(v) ? v : fallback;
};
const list = (name: string, fallback: string[] = []) => {
  const items = (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return items.length ? items : fallback;
};

export const REGISTRAR_IDS = [
  'cloudflare',
  'namecheap',
  'spaceship',
  'godaddy',
  'porkbun',
  'ovh',
  'namecom',
  'namesilo',
  'dynadot',
  'hostinger',
  'truehost',
  'whogohost',
] as const;

/** 5-field cron: minute hour day-of-month month day-of-week. */
const CRON = /^(\S+\s+){4}\S+$/;

export const SETTINGS: readonly SettingDef[] = [
  // --- Credits -------------------------------------------------------------
  {
    key: 'credits.perAiGeneration',
    group: 'Credits',
    type: 'number',
    label: 'AI generation run',
    description: 'Credits per AI name-generation run.',
    envVar: 'CREDIT_PER_AI_GENERATION',
    envDefault: () => num('CREDIT_PER_AI_GENERATION', 1),
    min: 0,
    max: 100,
  },
  {
    key: 'credits.perWordGeneration',
    group: 'Credits',
    type: 'number',
    label: 'Word-builder run',
    description: 'Credits per rule-based word-engine run.',
    envVar: 'CREDIT_PER_WORD_GENERATION',
    envDefault: () => num('CREDIT_PER_WORD_GENERATION', 0.25),
    min: 0,
    max: 100,
  },
  {
    key: 'credits.perDomainCheck',
    group: 'Credits',
    type: 'number',
    label: 'Per name × extension checked',
    description: 'Includes the full registrar price comparison.',
    envVar: 'CREDIT_PER_DOMAIN_CHECK',
    envDefault: () => num('CREDIT_PER_DOMAIN_CHECK', 0.05),
    min: 0,
    max: 10,
  },
  {
    key: 'credits.perPriceRefresh',
    group: 'Credits',
    type: 'number',
    label: 'Per domain price refresh (saved search)',
    description:
      'Re-reads prices from the daily catalog, no registrar calls. A live availability re-check costs the normal check price.',
    envVar: 'CREDIT_PER_PRICE_REFRESH',
    envDefault: () => num('CREDIT_PER_PRICE_REFRESH', 0.01),
    min: 0,
    max: 10,
  },
  {
    key: 'credits.freeEarly',
    group: 'Credits',
    type: 'number',
    label: 'Early-user welcome credits',
    description: 'Granted to each of the first N sign-ups.',
    envVar: 'FREE_CREDITS_EARLY',
    envDefault: () => num('FREE_CREDITS_EARLY', 10),
    min: 0,
    max: 1000,
  },
  {
    key: 'credits.freeEarlyLimit',
    group: 'Credits',
    type: 'int',
    label: 'Early-user limit (N)',
    description: 'How many sign-ups get the early grant.',
    envVar: 'FREE_CREDITS_EARLY_LIMIT',
    envDefault: () => num('FREE_CREDITS_EARLY_LIMIT', 500),
    min: 0,
    max: 1_000_000,
  },
  {
    key: 'credits.freeDefault',
    group: 'Credits',
    type: 'number',
    label: 'Welcome credits after that',
    description: 'Granted to every later sign-up.',
    envVar: 'FREE_CREDITS_DEFAULT',
    envDefault: () => num('FREE_CREDITS_DEFAULT', 5),
    min: 0,
    max: 1000,
  },
  // --- Registrars ----------------------------------------------------------
  {
    key: 'registrars.enabled',
    group: 'Registrars',
    type: 'list',
    label: 'Enabled registrars',
    description:
      'Shown in results. Empty means all. Unconfigured ones are skipped anyway.',
    envVar: 'ENABLED_REGISTRARS',
    envDefault: () => list('ENABLED_REGISTRARS'),
    options: REGISTRAR_IDS,
  },
  {
    key: 'registrars.checkerOrder',
    group: 'Registrars',
    type: 'list',
    label: 'Availability check order',
    description:
      'First configured registrar answers; later ones are fallbacks.',
    envVar: 'AVAILABILITY_CHECKER_ORDER',
    envDefault: () =>
      list('AVAILABILITY_CHECKER_ORDER', [
        'cloudflare',
        'namecheap',
        'spaceship',
        'godaddy',
      ]),
    options: REGISTRAR_IDS,
  },
  {
    key: 'registrars.links',
    group: 'Registrars',
    type: 'record',
    label: 'Buy-link overrides',
    description: 'Registrar id → URL with {domain}, e.g. an affiliate link.',
    envDefault: () => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        const m = /^REGISTRAR_LINK_(.+)$/.exec(k);
        if (m && v) out[m[1].toLowerCase()] = v;
      }
      return out;
    },
    pattern: /^https:\/\/\S+\{domain\}\S*$/,
    patternHint: 'https URL containing {domain}',
  },
  {
    key: 'registrars.affiliates',
    group: 'Registrars',
    type: 'record',
    label: 'Affiliate links',
    description:
      'Registrar id → affiliate URL wrapping the buy link. {url} = buy link URL-encoded (Impact ?u={url}), {rawurl} = as-is (CJ /type/dlg/{rawurl}), {domain} = the domain. No placeholder = used as-is (WHMCS aff.php?aff=ID).',
    envDefault: () => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        const m = /^REGISTRAR_AFFILIATE_(.+)$/.exec(k);
        if (m && v) out[m[1].toLowerCase()] = v;
      }
      return out;
    },
    pattern: /^(https:\/\/\S+|\{rawurl\}\S*)$/,
    patternHint:
      'https URL, optionally with {url}/{rawurl}/{domain}, or {rawurl}&param=ID',
  },
  {
    key: 'registrars.ovhSubsidiary',
    group: 'Registrars',
    type: 'enum',
    label: 'OVHcloud price region',
    description:
      'Sets OVH currency (IE/FR/DE… = EUR, GB = GBP). Applies at the next sync.',
    envVar: 'OVH_SUBSIDIARY',
    envDefault: () => process.env.OVH_SUBSIDIARY || 'IE',
    options: ['IE', 'GB', 'FR', 'DE', 'ES', 'IT', 'NL', 'PL', 'PT'],
  },
  // --- Prices ---------------------------------------------------------------
  {
    key: 'prices.syncCron',
    group: 'Prices',
    type: 'string',
    label: 'Daily price sync (cron, UTC)',
    description: 'When registrar price lists and exchange rates refresh.',
    envVar: 'PRICE_SYNC_CRON',
    envDefault: () => process.env.PRICE_SYNC_CRON || '15 3 * * *',
    pattern: CRON,
    patternHint: '5-field cron, e.g. "15 3 * * *"',
  },
  // --- AI ------------------------------------------------------------------
  {
    key: 'llm.provider',
    group: 'AI',
    type: 'enum',
    label: 'AI provider',
    description:
      'Used for AI name generation. Its API key must be set in .env.',
    envVar: 'LLM_PROVIDER',
    envDefault: () => (process.env.LLM_PROVIDER || 'openai').toLowerCase(),
    options: ['openai', 'anthropic', 'gemini'],
  },
  {
    key: 'llm.model.openai',
    group: 'AI',
    type: 'string',
    label: 'OpenAI model',
    description: 'Model id.',
    envVar: 'LLM_OPENAI_MODEL',
    envDefault: () => process.env.LLM_OPENAI_MODEL || 'gpt-4-turbo',
    pattern: /^[\w.:-]{2,80}$/,
    patternHint: 'model id',
  },
  {
    key: 'llm.model.anthropic',
    group: 'AI',
    type: 'string',
    label: 'Anthropic model',
    description: 'Model id.',
    envVar: 'LLM_ANTHROPIC_MODEL',
    envDefault: () => process.env.LLM_ANTHROPIC_MODEL || 'claude-opus-5-5',
    pattern: /^[\w.:-]{2,80}$/,
    patternHint: 'model id',
  },
  {
    key: 'llm.model.gemini',
    group: 'AI',
    type: 'string',
    label: 'Gemini model',
    description: 'Model id.',
    envVar: 'LLM_GEMINI_MODEL',
    envDefault: () => process.env.LLM_GEMINI_MODEL || 'gemini-2.5-flash',
    pattern: /^[\w.:-]{2,80}$/,
    patternHint: 'model id',
  },
  // --- Payments -------------------------------------------------------------
  {
    key: 'payments.currency',
    group: 'Payments',
    type: 'enum',
    label: 'Checkout currency',
    description: 'USD needs international payments enabled on Paystack.',
    envVar: 'PAYSTACK_CURRENCY',
    envDefault: () => (process.env.PAYSTACK_CURRENCY || 'USD').toUpperCase(),
    options: ['USD', 'NGN'],
  },
  {
    key: 'payments.ngnPerUsd',
    group: 'Payments',
    type: 'number',
    label: 'NGN per USD for pack prices',
    description: 'Only used when checkout currency is NGN.',
    envVar: 'PAYSTACK_NGN_PER_USD',
    envDefault: () => num('PAYSTACK_NGN_PER_USD', 1600),
    min: 100,
    max: 100_000,
  },
];

export const SETTINGS_BY_KEY = new Map(SETTINGS.map((s) => [s.key, s]));

/** Secrets: shown only as configured / not configured. */
export const SECRET_ENV_VARS = [
  'PAYSTACK_SECRET_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'NAMECHEAP_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'SPACESHIP_API_KEY',
  'GODADDY_API_KEY',
  'NAMECOM_API_TOKEN',
  'NAMESILO_API_KEY',
  'DYNADOT_API_KEY',
  'HOSTINGER_API_TOKEN',
  'GITHUB_CLIENT_SECRET',
  'GOOGLE_CLIENT_SECRET',
  'JWT_SECRET',
] as const;

/**
 * Validate and normalise a value for a setting. Throws an Error with a
 * user-readable message when invalid.
 */
export function validateSetting(def: SettingDef, value: unknown): unknown {
  const fail = (msg: string): never => {
    throw new Error(`${def.label}: ${msg}`);
  };
  switch (def.type) {
    case 'number':
    case 'int': {
      const n = typeof value === 'string' ? Number(value) : value;
      if (typeof n !== 'number' || !Number.isFinite(n))
        fail('must be a number');
      const v = n as number;
      if (def.type === 'int' && !Number.isInteger(v))
        fail('must be a whole number');
      if (def.min !== undefined && v < def.min) fail(`must be ≥ ${def.min}`);
      if (def.max !== undefined && v > def.max) fail(`must be ≤ ${def.max}`);
      return def.type === 'number' ? Math.round(v * 10000) / 10000 : v;
    }
    case 'string': {
      if (typeof value !== 'string') fail('must be text');
      const v = (value as string).trim();
      if (def.pattern && !def.pattern.test(v))
        fail(`expected ${def.patternHint ?? def.pattern}`);
      return v;
    }
    case 'enum': {
      if (typeof value !== 'string' || !def.options!.includes(value)) {
        fail(`must be one of ${def.options!.join(', ')}`);
      }
      return value;
    }
    case 'list': {
      if (!Array.isArray(value)) fail('must be a list');
      const items = [
        ...new Set(
          (value as unknown[]).map((x) => String(x).trim().toLowerCase()),
        ),
      ].filter(Boolean);
      const bad = items.filter((x) => def.options && !def.options.includes(x));
      if (bad.length) fail(`unknown: ${bad.join(', ')}`);
      return items;
    }
    case 'record': {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        fail('must be an object');
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const id = k.trim().toLowerCase();
        const url = String(v).trim();
        if (!url) continue;
        if (def.pattern && !def.pattern.test(url))
          fail(`${id}: expected ${def.patternHint}`);
        out[id] = url;
      }
      return out;
    }
  }
}
