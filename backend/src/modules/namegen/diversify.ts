import { editDistance } from './phonology';
import type { RankedName } from './types';

/**
 * Greedy diverse top-N: skip near-duplicates (edit distance ≤ 1) of names
 * already chosen, cap any one technique at 40%, any 4-letter start at 2 and
 * any one seed at its fair share, then relax the caps if the list is short.
 */
export function diversify(sorted: RankedName[], count: number): RankedName[] {
  const techniques = new Set(sorted.map((n) => n.technique)).size;
  const techniqueCap = techniques > 1 ? Math.ceil(count * 0.4) : count;
  const seeds = new Set(sorted.map((n) => n.seedGroup).filter(Boolean)).size;
  const seedCap = seeds > 1 ? Math.ceil(count / seeds) + 1 : count;

  const bump = (m: Map<string, number>, k: string | undefined) => {
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  };

  const pick = (strict: boolean, chosen: RankedName[]) => {
    const perTechnique = new Map<string, number>();
    const perStart = new Map<string, number>();
    const perSeed = new Map<string, number>();
    for (const c of chosen) {
      bump(perTechnique, c.technique);
      bump(perStart, c.name.slice(0, 4));
      bump(perSeed, c.seedGroup);
    }
    for (const n of sorted) {
      if (chosen.length >= count) break;
      if (chosen.some((c) => c.name === n.name)) continue;
      if (strict) {
        if ((perTechnique.get(n.technique) ?? 0) >= techniqueCap) continue;
        if ((perStart.get(n.name.slice(0, 4)) ?? 0) >= 2) continue;
        if (n.seedGroup && (perSeed.get(n.seedGroup) ?? 0) >= seedCap) continue;
        if (chosen.some((c) => editDistance(c.name, n.name, 1) <= 1)) continue;
      }
      chosen.push(n);
      bump(perTechnique, n.technique);
      bump(perStart, n.name.slice(0, 4));
      bump(perSeed, n.seedGroup);
    }
    return chosen;
  };

  const chosen = pick(true, []);
  return chosen.length < count ? pick(false, chosen) : chosen;
}
