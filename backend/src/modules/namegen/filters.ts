import type { Lexicon } from './lexicon';
import { editDistance } from './phonology';
import type { Candidate, NormalizedConfig, Technique } from './types';

/** Techniques that should produce new words, not existing dictionary words. */
const INVENTIVE: ReadonlySet<Technique> = new Set(['coin', 'markov', 'rhyme']);

export type RejectReason =
  | 'label'
  | 'length'
  | 'shape'
  | 'unpronounceable'
  | 'blocked'
  | 'brand'
  | 'real-word';

/**
 * Hard filters: DNS label rules and length, letter-shape sanity, profanity
 * (also across join points), near-duplicates of famous brands, and plain
 * dictionary words for inventive techniques. Returns null when the name passes.
 */
export function rejectReason(
  c: Candidate,
  cfg: NormalizedConfig,
  lex: Lexicon,
): RejectReason | null {
  const name = c.name;
  const charset = cfg.allowDigits ? 'a-z0-9' : 'a-z';
  const label = cfg.allowHyphen
    ? new RegExp(`^[${charset}]+(-[${charset}]+)*$`)
    : new RegExp(`^[${charset}]+$`);
  if (!label.test(name) || name.startsWith('xn--')) return 'label';
  if (name.length < cfg.minLen || name.length > cfg.maxLen) return 'length';

  const letters = name.replace(/[^a-z]/g, '');
  if (!/[aeiouy]/.test(letters)) return 'shape';
  if (/(.)\1\1/.test(letters)) return 'shape';
  if (/[^aeiouy]{4}/.test(letters) || /[aeiou]{4}/.test(letters))
    return 'shape';
  if (/q(?!u)/.test(letters)) return 'shape';
  if (/(.{3,})\1/.test(letters)) return 'shape'; // stutters: "lunlunch", "ledledger"
  if (!lex.isPronounceable(letters)) return 'unpronounceable';

  for (const bad of lex.blocklist) {
    if (
      bad.length >= 4
        ? name.includes(bad)
        : name === bad || c.parts?.includes(bad)
    ) {
      return 'blocked';
    }
  }

  for (const brand of lex.brands) {
    if (name === brand) return 'brand';
    if (name.length >= 5 && Math.abs(name.length - brand.length) <= 1) {
      if (editDistance(name, brand, 1) <= 1) return 'brand';
    }
  }

  if (INVENTIVE.has(c.technique) && lex.wordSet.has(name)) return 'real-word';
  return null;
}
