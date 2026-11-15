import type { Lexicon } from './lexicon';
import {
  LIGHT_VOWELS,
  STRONG_CONSONANTS,
  STRONG_VOWELS,
  syllabify,
} from './phonology';
import type { Candidate, NormalizedConfig } from './types';

/** Spellings people mishear or mistype when a name is said aloud ("radio test"). */
const SPELLING_TRAPS = [
  /ph/,
  /gh/,
  /([a-z])\1/,
  /c[ei]/,
  /kn/,
  /wr/,
  /x[aeiou]/,
  /ae/,
  /eu/,
];

/**
 * Brandability score in roughly 0–1 (weighted sum):
 *   pronounceability 0.35, length 0.20, memorability 0.15,
 *   seed retention 0.15, sound-symbolism fit 0.10, minus spelling penalties.
 */
export function scoreName(
  c: Candidate,
  cfg: NormalizedConfig,
  lex: Lexicon,
  seeds: string[],
): number {
  const name = c.name;
  const letters = name.replace(/[^a-z]/g, '');

  const pron = lex.pronounceability(letters);

  // Length: Gaussian around 7 letters.
  const len = Math.exp(-((name.length - 7) ** 2) / (2 * 2.5 ** 2));

  // Memorability: 2 syllables ideal, plosive start, alliteration/rhyme between parts.
  const syllables = syllabify(letters).length;
  let memo =
    syllables === 2
      ? 0.5
      : syllables === 3
        ? 0.35
        : syllables === 1
          ? 0.25
          : 0.1;
  if (STRONG_CONSONANTS.includes(name[0])) memo += 0.2;
  if (c.parts && c.parts.length === 2 && c.parts[0][0] === c.parts[1][0])
    memo += 0.3;
  memo = Math.min(1, memo);

  // Seed retention: keeps the user's word whole (1), was built from it, e.g.
  // a blend or clip of it (0.7; a blend of two seeds counts fully), or at
  // least keeps its first three letters (0.5).
  let seed = 0;
  const fromSeeds = c.parts?.filter((p) => seeds.includes(p)).length ?? 0;
  if (fromSeeds >= 2) seed = 1;
  for (const s of seeds) {
    if (name.includes(s)) seed = Math.max(seed, 1);
    else if (c.parts?.includes(s)) seed = Math.max(seed, 0.7);
    else if (s.length >= 3 && name.includes(s.slice(0, 3)))
      seed = Math.max(seed, 0.5);
  }

  // Sound symbolism: share of vowels matching the requested feel.
  let feel = 0.5;
  if (cfg.feel !== 'neutral') {
    const vowels = letters.split('').filter((ch) => 'aeiouy'.includes(ch));
    const target = cfg.feel === 'light' ? LIGHT_VOWELS : STRONG_VOWELS;
    feel = vowels.length
      ? vowels.filter((v) => target.includes(v)).length / vowels.length
      : 0;
  }

  const penalty = SPELLING_TRAPS.filter((re) => re.test(letters)).length * 0.04;

  return (
    0.35 * pron + 0.2 * len + 0.15 * memo + 0.15 * seed + 0.1 * feel - penalty
  );
}
