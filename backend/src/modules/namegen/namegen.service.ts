import { Injectable, Logger } from '@nestjs/common';
import { diversify } from './diversify';
import { rejectReason } from './filters';
import { getLexicon, type Lexicon } from './lexicon';
import { normalizeSeed } from './phonology';
import { Rng, hashString } from './rng';
import { scoreName } from './scoring';
import type { GenContext } from './strategies/context';
import { NEEDS_SEEDS, STRATEGIES } from './strategies';
import {
  DEFAULT_PATTERNS,
  DEFAULT_STRATEGIES,
  type GeneratedName,
  type NormalizedConfig,
  type RankedName,
  type WordEngineConfig,
} from './types';

/**
 * The word engine: rule-based, deterministic name generation without AI.
 * Pipeline: normalise seeds -> run strategies -> hard filters -> score -> diversify.
 */
@Injectable()
export class NamegenService {
  private readonly logger = new Logger(NamegenService.name);

  private get lex(): Lexicon {
    return getLexicon();
  }

  normalize(config: WordEngineConfig): NormalizedConfig {
    const seeds = [...new Set(config.seeds.flatMap(normalizeSeed))].slice(0, 5);
    const minLen = Math.max(2, config.minLen ?? 4);
    const maxLen = Math.min(63, Math.max(minLen, config.maxLen ?? 12));
    const strategies = config.strategies?.length
      ? config.strategies
      : DEFAULT_STRATEGIES;
    const patterns = (
      config.patterns?.length ? config.patterns : DEFAULT_PATTERNS
    )
      .map((p) => p.toUpperCase())
      .filter((p) => /^[CV]{2,10}$/.test(p));
    const clean = (list?: string[]) =>
      [
        ...new Set(
          (list ?? []).map((a) => a.toLowerCase().replace(/[^a-z]/g, '')),
        ),
      ]
        .filter((a) => a.length >= 1 && a.length <= 12)
        .slice(0, 30);
    const normalized: NormalizedConfig = {
      seeds,
      strategies: [...new Set(strategies)],
      patterns: patterns.length ? patterns : DEFAULT_PATTERNS,
      prefixes: clean(config.prefixes),
      suffixes: clean(config.suffixes),
      useBuiltInAffixes: config.useBuiltInAffixes ?? true,
      minLen,
      maxLen,
      allowHyphen: config.allowHyphen ?? false,
      allowDigits: config.allowDigits ?? false,
      feel: config.feel ?? 'neutral',
      count: Math.min(100, Math.max(1, config.count ?? 15)),
      seed: 0,
    };
    normalized.seed =
      config.seed ?? hashString(JSON.stringify({ ...normalized, seed: 0 }));
    return normalized;
  }

  generate(config: WordEngineConfig): GeneratedName[] {
    const started = Date.now();
    const cfg = this.normalize(config);
    const lex = this.lex;
    const rng = new Rng(cfg.seed);

    const ctx: GenContext = {
      cfg,
      lex,
      rng,
      seeds: cfg.seeds,
      partners: this.partnersFor(cfg.seeds, lex, rng),
      suffixes: [
        ...cfg.suffixes,
        ...(cfg.useBuiltInAffixes ? lex.affixes.suffixes : []),
      ],
      prefixes: [
        ...cfg.prefixes,
        ...(cfg.useBuiltInAffixes ? lex.affixes.prefixes : []),
      ],
    };

    // Without seeds only the inventive strategies can run.
    let strategies = cfg.strategies.filter(
      (s) => cfg.seeds.length > 0 || !NEEDS_SEEDS.has(s),
    );
    if (!strategies.length) strategies = ['coin', 'markov'];

    const best = new Map<string, RankedName>();
    for (const technique of strategies) {
      for (const c of STRATEGIES[technique](ctx)) {
        if (best.has(c.name)) continue;
        if (rejectReason(c, cfg, lex)) continue;
        best.set(c.name, {
          name: c.name,
          technique: c.technique,
          score: Math.round(scoreName(c, cfg, lex, cfg.seeds) * 1000) / 1000,
          seedGroup: cfg.seeds.find(
            (s) => c.parts?.includes(s) || c.name.includes(s),
          ),
        });
      }
    }

    const sorted = [...best.values()].sort(
      (a, b) => b.score - a.score || a.name.localeCompare(b.name),
    );
    const result = diversify(sorted, cfg.count).map(
      ({ name, technique, score }): GeneratedName => ({
        name,
        technique,
        score,
      }),
    );
    this.logger.debug(
      `Word engine: ${best.size} candidates -> ${result.length} names in ${Date.now() - started}ms`,
    );
    return result;
  }

  /** Words to combine with the seeds: each other, WordNet relatives, then brandable nouns. */
  private partnersFor(seeds: string[], lex: Lexicon, rng: Rng): string[] {
    const partners = new Set<string>(seeds);
    for (const s of seeds) {
      for (const r of lex.relatedTo(s).slice(0, 6)) {
        if (r.length <= 8) partners.add(r);
      }
    }
    for (const w of rng.shuffle(lex.affixes.compoundWords)) {
      if (partners.size >= 30) break;
      partners.add(w);
    }
    return [...partners];
  }
}
