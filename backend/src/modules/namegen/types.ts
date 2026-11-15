/** Naming techniques the word engine can apply (Özbal & Strapparava's devices). */
export const TECHNIQUES = [
  'compound',
  'blend',
  'affix',
  'clip',
  'respell',
  'rhyme',
  'alliterate',
  'coin',
  'markov',
] as const;
export type Technique = (typeof TECHNIQUES)[number];

export type Feel = 'neutral' | 'light' | 'strong';

export interface WordEngineConfig {
  /** The user's own words or name, e.g. ["ayo", "ledger"]. */
  seeds: string[];
  strategies?: Technique[];
  /** Syllable templates for `coin`, e.g. "CVCV", "CVCCV". */
  patterns?: string[];
  prefixes?: string[];
  suffixes?: string[];
  useBuiltInAffixes?: boolean;
  minLen?: number;
  maxLen?: number;
  allowHyphen?: boolean;
  allowDigits?: boolean;
  feel?: Feel;
  count?: number;
  /** Same config + same seed = same names. Change it for "more like this". */
  seed?: number;
}

export type NormalizedConfig = Required<WordEngineConfig>;

export interface Candidate {
  name: string;
  technique: Technique;
  /** Source words, when the name was built from them (used for filters/scoring). */
  parts?: string[];
}

export interface GeneratedName {
  name: string;
  technique: Technique;
  score: number;
}

/** Internal: a scored name plus the seed it came from, for balancing. */
export interface RankedName extends GeneratedName {
  seedGroup?: string;
}

export const DEFAULT_STRATEGIES: Technique[] = [
  'compound',
  'blend',
  'affix',
  'clip',
  'respell',
  'rhyme',
  'alliterate',
  'coin',
];
export const DEFAULT_PATTERNS = ['CVCV', 'CVCCV', 'CVCVC'];
