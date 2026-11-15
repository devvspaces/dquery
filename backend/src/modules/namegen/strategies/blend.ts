import { isVowelAt, syllabify } from '../phonology';
import type { Candidate } from '../types';
import { STRATEGY_CAP, type GenContext } from './context';

/**
 * Portmanteaus: a prefix of A + a suffix of B (Gangal et al. 2017), cut at
 * a shared-letter overlap (Deri & Knight 2015), at syllable boundaries, or
 * where both words share a vowel. Requires the result to keep a recognisable
 * piece of each word and be shorter than plain concatenation.
 */
export function blendPair(a: string, b: string): string[] {
  const out = new Set<string>();
  if (a.length < 3 || b.length < 3 || a === b) return [];

  // 1. Overlap: A's ending equals B's beginning (motor + hotel -> motel style overlaps).
  for (let k = Math.min(a.length, b.length) - 1; k >= 1; k--) {
    if (a.endsWith(b.slice(0, k))) out.add(a + b.slice(k));
  }
  // 2. Shared vowel alignment: br|eakfast + l|unch-style cuts on the same vowel.
  for (let i = 1; i < a.length - 1; i++) {
    for (let j = 1; j < b.length - 1; j++) {
      if (a[i] === b[j] && isVowelAt(a, i)) out.add(a.slice(0, i) + b.slice(j));
    }
  }
  // 2b. Same idea on consonants: brea|k|fast + l|unch -> "brunch" needs A's onset + B's rime.
  const onsetA = /^[^aeiouy]+/.exec(a)?.[0] ?? '';
  const rimeB = b.slice((/^[^aeiouy]+/.exec(b)?.[0] ?? '').length);
  if (onsetA && rimeB) out.add(onsetA + rimeB);
  // 3. Syllable boundaries: first syllable(s) of A + last syllable(s) of B.
  const sa = syllabify(a);
  const sb = syllabify(b);
  for (let i = 1; i <= sa.length; i++) {
    for (let j = 0; j < sb.length; j++) {
      if (i === sa.length && j === 0) continue; // that's just A+B
      out.add(sa.slice(0, i).join('') + sb.slice(j).join(''));
    }
  }

  return [...out].filter(
    (r) =>
      r.length < a.length + b.length - 1 &&
      r !== a &&
      r !== b &&
      r.length >= 4 &&
      sharesPiece(r, a, 'start') &&
      sharesPiece(r, b, 'end'),
  );
}

/** The blend must start with ≥2 letters of A and end with ≥2 letters of B. */
function sharesPiece(r: string, w: string, side: 'start' | 'end'): boolean {
  return side === 'start'
    ? r.startsWith(w.slice(0, 2))
    : r.endsWith(w.slice(-2));
}

export function blend(ctx: GenContext): Candidate[] {
  const pairs = (others: string[]) =>
    ctx.seeds.flatMap((s) =>
      others
        .filter((p) => p !== s)
        .flatMap((p) => [
          [s, p],
          [p, s],
        ]),
    );
  const fromPairs = (list: string[][]) =>
    list.flatMap(([a, b]) =>
      blendPair(a, b).map(
        (name): Candidate => ({ name, technique: 'blend', parts: [a, b] }),
      ),
    );
  // Seed × seed blends are what the user asked for, so they're never dropped;
  // blends with partner words fill the remaining room.
  const seedBlends = fromPairs(pairs(ctx.seeds));
  const partnerBlends = ctx.rng.shuffle(
    fromPairs(pairs(ctx.partners.filter((p) => !ctx.seeds.includes(p)))),
  );
  return [...seedBlends, ...partnerBlends].slice(0, STRATEGY_CAP);
}
