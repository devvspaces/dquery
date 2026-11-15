import type { Candidate } from '../types';
import { STRATEGY_CAP, type GenContext } from './context';

const ATTEMPTS = 500;

/**
 * Invented words that "sound English" (Wordoid-style): an order-3 letter
 * Markov chain trained on the lexicon. Seeds steer it by fixing the start.
 */
export function markov(ctx: GenContext): Candidate[] {
  const out: Candidate[] = [];
  const { minLen, maxLen } = ctx.cfg;
  const prefixes = [
    '',
    ...ctx.seeds.map((s) => s.slice(0, Math.min(3, s.length))),
  ];
  for (let n = 0; n < ATTEMPTS; n++) {
    const prefix = prefixes[n % prefixes.length];
    const word = ctx.lex.invent(ctx.rng, maxLen, prefix);
    if (!word || word.length < minLen || ctx.lex.wordSet.has(word)) continue;
    out.push({
      name: word,
      technique: 'markov',
      parts: prefix ? [prefix] : undefined,
    });
  }
  return out.slice(0, STRATEGY_CAP);
}
