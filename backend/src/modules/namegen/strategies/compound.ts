import { joinParts } from '../phonology';
import type { Candidate } from '../types';
import { STRATEGY_CAP, type GenContext } from './context';

/** A+B and B+A: Facebook, YouTube. */
export function compound(ctx: GenContext): Candidate[] {
  const out: Candidate[] = [];
  for (const s of ctx.seeds) {
    for (const p of ctx.partners) {
      if (p === s) continue;
      out.push({ name: joinParts(s, p), technique: 'compound', parts: [s, p] });
      out.push({ name: joinParts(p, s), technique: 'compound', parts: [p, s] });
    }
  }
  return out.slice(0, STRATEGY_CAP);
}
