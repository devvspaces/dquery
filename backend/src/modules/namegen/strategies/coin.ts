import {
  CODA_CLUSTERS,
  LIGHT_CONSONANTS,
  LIGHT_VOWELS,
  MEDIAL_CLUSTERS,
  ONSET_CLUSTERS,
  SINGLE_CODAS,
  SINGLE_ONSETS,
  STRONG_CONSONANTS,
  STRONG_VOWELS,
  syllabify,
} from '../phonology';
import type { Rng } from '../rng';
import type { Candidate, Feel } from '../types';
import { STRATEGY_CAP, type GenContext } from './context';

const VOWEL_LETTERS = ['a', 'e', 'i', 'o', 'u'];
const PER_PATTERN = 120;

/** Weight letters toward the chosen sound-symbolism feel. */
function weights(
  letters: readonly string[],
  feel: Feel,
  kind: 'v' | 'c',
): number[] {
  const favoured =
    feel === 'light'
      ? kind === 'v'
        ? LIGHT_VOWELS
        : LIGHT_CONSONANTS
      : feel === 'strong'
        ? kind === 'v'
          ? STRONG_VOWELS
          : STRONG_CONSONANTS
        : [];
  return letters.map((l) => (favoured.some((f) => l.includes(f)) ? 3 : 1));
}

/**
 * Fill a C/V template, e.g. "CVCCV" -> "milto". Runs of C use position-aware
 * inventories: onset clusters at the start, medial clusters inside, codas at the end.
 */
export function fillPattern(
  pattern: string,
  rng: Rng,
  feel: Feel = 'neutral',
): string | null {
  const p = pattern.toUpperCase();
  if (!/^[CV]{2,10}$/.test(p)) return null;
  let out = '';
  let i = 0;
  while (i < p.length) {
    if (p[i] === 'V') {
      out += rng.weighted(VOWEL_LETTERS, weights(VOWEL_LETTERS, feel, 'v'));
      i++;
      continue;
    }
    let run = 0;
    while (p[i + run] === 'C') run++;
    const atStart = i === 0;
    const atEnd = i + run === p.length;
    const pool =
      run === 1
        ? atEnd
          ? SINGLE_CODAS
          : SINGLE_ONSETS
        : run === 2
          ? atStart
            ? ONSET_CLUSTERS
            : atEnd
              ? CODA_CLUSTERS
              : MEDIAL_CLUSTERS
          : null;
    if (!pool) return null; // 3+ consonants in a row aren't supported
    out += rng.weighted(pool, weights(pool, feel, 'c'));
    i += run;
  }
  return out;
}

/** Invented names from templates, plus seed syllables with coined tails. */
export function coin(ctx: GenContext): Candidate[] {
  const out: Candidate[] = [];
  for (const pattern of ctx.cfg.patterns) {
    for (let n = 0; n < PER_PATTERN; n++) {
      const name = fillPattern(pattern, ctx.rng, ctx.cfg.feel);
      if (name) out.push({ name, technique: 'coin' });
    }
  }
  // Seeded coins: keep a piece of the user's word and invent the rest (ledger -> "ledova").
  const tails = ['V', 'VC', 'CV', 'VCV', 'CVC', 'VCCV'];
  for (const s of ctx.seeds) {
    const syl = syllabify(s);
    const heads = new Set([syl[0], s.length <= 4 ? s : syl[0]]);
    for (const head of heads) {
      if (head.length < 2) continue;
      const endsInVowel = /[aeiouy]$/.test(head);
      for (const tail of tails) {
        if (endsInVowel === (tail[0] === 'V')) continue; // keep C/V alternating at the seam
        for (let n = 0; n < 12; n++) {
          const t = fillPattern(tail, ctx.rng, ctx.cfg.feel);
          if (t) out.push({ name: head + t, technique: 'coin', parts: [s] });
        }
      }
    }
  }
  return out.slice(0, STRATEGY_CAP * 2);
}
