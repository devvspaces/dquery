import type { Lexicon } from '../lexicon';
import type { Rng } from '../rng';
import type { Candidate, NormalizedConfig } from '../types';

export interface GenContext {
  cfg: NormalizedConfig;
  lex: Lexicon;
  rng: Rng;
  /** Normalised seed words. */
  seeds: string[];
  /** Words to pair seeds with: other seeds, related words, brandable nouns. */
  partners: string[];
  suffixes: string[];
  prefixes: string[];
}

export type Strategy = (ctx: GenContext) => Candidate[];

/** Upper bound on candidates per strategy, so one technique can't flood the pool. */
export const STRATEGY_CAP = 600;
