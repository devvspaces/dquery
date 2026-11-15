import type { Candidate } from '../types';
import { STRATEGY_CAP, type GenContext } from './context';

/** Pair the seed with words starting with the same letter: PayPal, Dunkin' Donuts. */
export function alliterate(ctx: GenContext): Candidate[] {
  const out: Candidate[] = [];
  for (const s of ctx.seeds) {
    const first = s[0];
    const pool = new Set([
      ...ctx.partners,
      ...ctx.lex.affixes.compoundWords,
      ...ctx.lex.words
        .slice(0, 8000)
        .filter((w) => w.length >= 3 && w.length <= 6),
    ]);
    const matches = ctx.rng
      .shuffle([...pool].filter((w) => w[0] === first && w !== s))
      .slice(0, 40);
    for (const w of matches) {
      out.push({ name: s + w, technique: 'alliterate', parts: [s, w] });
      out.push({ name: w + s, technique: 'alliterate', parts: [w, s] });
    }
  }
  return out.slice(0, STRATEGY_CAP);
}
