import { isVowelAt, syllabify } from '../phonology';
import type { Candidate } from '../types';
import { STRATEGY_CAP, type GenContext } from './context';

/** Truncation plus a vowel ending: Instagram -> Insta, Intelligence -> Intel. */
export function clip(ctx: GenContext): Candidate[] {
  const out: Candidate[] = [];
  const endings = ctx.lex.affixes.vowelEndings;
  for (const s of ctx.seeds) {
    const syl = syllabify(s);
    const stems = new Set<string>();
    if (syl.length >= 2) stems.add(syl[0]);
    if (syl.length >= 3) stems.add(syl.slice(0, 2).join(''));
    if (syl.length === 1) stems.add(s);
    for (const stem of stems) {
      if (stem.length >= 3 && stem !== s) {
        out.push({ name: stem, technique: 'clip', parts: [s] });
      }
      const endsInVowel = isVowelAt(stem, stem.length - 1);
      for (const e of endings) {
        const name = endsInVowel ? stem.slice(0, -1) + e : stem + e;
        if (name !== s) out.push({ name, technique: 'clip', parts: [s] });
      }
    }
  }
  return out.slice(0, STRATEGY_CAP);
}
