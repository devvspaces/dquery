import type { Candidate } from '../types';
import { STRATEGY_CAP, type GenContext } from './context';

/** Ordered respelling rules: Flickr, Tumblr, Lyft, Digg, Kwik. */
const RULES: Array<[RegExp, string]> = [
  [/er$/, 'r'],
  [/([^aeiou])le$/, '$1l'],
  [/ph/, 'f'],
  [/ck/, 'k'],
  [/c(?=[aou])/, 'k'],
  [/qu/, 'kw'],
  [/s$/, 'z'],
  [/i/, 'y'],
  [/ou/, 'u'],
  [/ee/, 'ea'],
  [/x/, 'ks'],
  [/([bdgpt])$/, '$1$1'],
  [/y$/, 'ie'],
  [/ight/, 'ite'],
];

export function respellWord(word: string): string[] {
  const out = new Set<string>();
  for (const [pattern, replacement] of RULES) {
    const r = word.replace(pattern, replacement);
    if (r !== word) out.add(r);
  }
  return [...out];
}

export function respell(ctx: GenContext): Candidate[] {
  const out: Candidate[] = [];
  const bases = [
    ...ctx.seeds,
    // Short compounds get respelled too (e.g. "quicklink" -> "kwiklink").
    ...ctx.seeds.flatMap((s) => ctx.partners.slice(0, 6).map((p) => s + p)),
  ];
  for (const base of bases) {
    for (const name of respellWord(base)) {
      out.push({ name, technique: 'respell', parts: [base] });
    }
  }
  return out.slice(0, STRATEGY_CAP);
}
