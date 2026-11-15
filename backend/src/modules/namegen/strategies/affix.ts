import { joinParts } from '../phonology';
import type { Candidate } from '../types';
import { STRATEGY_CAP, type GenContext } from './context';

/** Seed + suffix (Spotify, Feedly) and prefix + seed (GetResponse, TryHackMe). */
export function affix(ctx: GenContext): Candidate[] {
  const out: Candidate[] = [];
  for (const s of ctx.seeds) {
    for (const suf of ctx.suffixes) {
      out.push({
        name: joinParts(s, suf),
        technique: 'affix',
        parts: [s, suf],
      });
    }
    for (const pre of ctx.prefixes) {
      out.push({
        name: joinParts(pre, s),
        technique: 'affix',
        parts: [pre, s],
      });
    }
  }
  return out.slice(0, STRATEGY_CAP);
}
