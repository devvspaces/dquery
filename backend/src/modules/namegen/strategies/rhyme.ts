import { ONSET_CLUSTERS, SINGLE_ONSETS, onsetOf } from '../phonology';
import type { Candidate } from '../types';
import { STRATEGY_CAP, type GenContext } from './context';

/**
 * Rhyme-based names:
 * - onset swap (Zillow ← pillow): replace the seed's leading consonants;
 * - rhyming pairs (HubSpot-style) using CMUdict rimes for known seeds.
 */
export function rhyme(ctx: GenContext): Candidate[] {
  const out: Candidate[] = [];
  const onsets = [...SINGLE_ONSETS, ...ONSET_CLUSTERS];
  for (const s of ctx.seeds) {
    const onset = onsetOf(s);
    const rest = s.slice(onset.length);
    if (rest.length >= 2) {
      for (const o of onsets) {
        if (o !== onset)
          out.push({ name: o + rest, technique: 'rhyme', parts: [s] });
      }
    }
    const rime = ctx.lex.rimeOf(s);
    if (rime) {
      const rhymes = ctx.lex.words
        .slice(0, 15_000)
        .filter(
          (w) =>
            w !== s &&
            w.length >= 3 &&
            w.length <= 6 &&
            ctx.lex.rimeOf(w) === rime &&
            !w.endsWith(s) &&
            !s.endsWith(w),
        )
        .slice(0, 25);
      for (const w of rhymes) {
        out.push({ name: s + w, technique: 'rhyme', parts: [s, w] });
        out.push({ name: w + s, technique: 'rhyme', parts: [w, s] });
      }
    }
  }
  return out.slice(0, STRATEGY_CAP);
}
