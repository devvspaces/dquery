import { readFileSync } from 'fs';
import { join } from 'path';
import type { Rng } from './rng';

const load = <T>(file: string): T =>
  JSON.parse(readFileSync(join(__dirname, 'data', file), 'utf8')) as T;

interface Affixes {
  suffixes: string[];
  prefixes: string[];
  compoundWords: string[];
  vowelEndings: string[];
}

const BOS = '^';
const EOS = '$';
const ALPHABET = 28; // a–z + start + end
const K = 0.1; // add-k smoothing

/**
 * All word data plus two letter models trained on the lexicon:
 * - a trigram model that scores how English-like (pronounceable) a string is;
 * - an order-3 Markov chain with backoff that invents new words.
 * Built once per process (~30k words, a few hundred ms).
 */
export class Lexicon {
  readonly words: string[];
  readonly wordSet: Set<string>;
  readonly rank: Map<string, number>;
  readonly pron: Record<string, [number, string, string]>;
  readonly related: Record<string, string[]>;
  readonly blocklist: string[];
  readonly brands: string[];
  /** Blocklist words of 4+ letters as one regex (matched anywhere in a name). */
  readonly blockedSubstring: RegExp;
  /** Blocklist words of ≤3 letters (matched only as a whole name or part). */
  readonly blockedShort: Set<string>;
  /** Brands grouped by length, for cheap look-alike checks. */
  readonly brandsByLength = new Map<number, string[]>();
  readonly affixes: Affixes;

  /** Trigram and bigram-context counts for the scoring model. */
  private readonly tri = new Map<string, number>();
  private readonly ctx = new Map<string, number>();
  /** Markov chains by order (1–3): context -> next-letter counts. */
  private readonly chains: Array<Map<string, Map<string, number>>> = [];
  /** Real-word score percentiles, for normalising pronounceability. */
  readonly realWordP1: number;
  readonly realWordP10: number;
  readonly realWordP50: number;

  constructor() {
    this.words = load<string[]>('lexicon.json');
    this.wordSet = new Set(this.words);
    this.rank = new Map(this.words.map((w, i) => [w, i]));
    this.pron = load('pron.json');
    this.related = load('related.json');
    this.blocklist = load('blocklist.json');
    this.brands = load('brands.json');
    const long = this.blocklist.filter((w) => w.length >= 4);
    this.blockedSubstring = new RegExp(long.join('|'));
    this.blockedShort = new Set(this.blocklist.filter((w) => w.length < 4));
    for (const b of this.brands) {
      const list = this.brandsByLength.get(b.length) ?? [];
      list.push(b);
      this.brandsByLength.set(b.length, list);
    }
    const affixes = load<Affixes>('affixes.json');
    this.affixes = {
      suffixes: [...new Set(affixes.suffixes)],
      prefixes: [...new Set(affixes.prefixes)],
      compoundWords: [...new Set(affixes.compoundWords)],
      vowelEndings: [...new Set(affixes.vowelEndings)],
    };

    for (let order = 1; order <= 3; order++) this.chains[order] = new Map();
    for (const word of this.words) this.train(word);

    const scores = this.words
      .slice(0, 10_000)
      .filter((w) => w.length >= 4)
      .map((w) => this.logProb(w))
      .sort((a, b) => a - b);
    const at = (p: number) => scores[Math.floor(scores.length * p)];
    this.realWordP1 = at(0.01);
    this.realWordP10 = at(0.1);
    this.realWordP50 = at(0.5);
  }

  private train(word: string) {
    const padded = BOS + BOS + word + EOS;
    for (let i = 2; i < padded.length; i++) {
      const c2 = padded.slice(i - 2, i);
      this.ctx.set(c2, (this.ctx.get(c2) ?? 0) + 1);
      const t = c2 + padded[i];
      this.tri.set(t, (this.tri.get(t) ?? 0) + 1);
    }
    const chainPadded = BOS.repeat(3) + word + EOS;
    for (let i = 3; i < chainPadded.length; i++) {
      for (let order = 1; order <= 3; order++) {
        const context = chainPadded.slice(i - order, i);
        const chain = this.chains[order];
        let next = chain.get(context);
        if (!next) chain.set(context, (next = new Map()));
        const ch = chainPadded[i];
        next.set(ch, (next.get(ch) ?? 0) + 1);
      }
    }
  }

  /** Mean log-probability per letter transition (higher = more English-like). */
  logProb(name: string): number {
    const padded = BOS + BOS + name + EOS;
    let sum = 0;
    let n = 0;
    for (let i = 2; i < padded.length; i++) {
      const c2 = padded.slice(i - 2, i);
      const t = c2 + padded[i];
      sum += Math.log(
        ((this.tri.get(t) ?? 0) + K) / ((this.ctx.get(c2) ?? 0) + K * ALPHABET),
      );
      n++;
    }
    return sum / n;
  }

  /**
   * Pronounceability in 0–1: a real word at the median scores 0.85, one at
   * the 10th percentile 0.5.
   */
  pronounceability(name: string): number {
    const lp = this.logProb(name);
    const span = this.realWordP50 - this.realWordP10 || 1;
    const score = 0.5 + ((lp - this.realWordP10) / span) * 0.35;
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Hard floor for "is this sayable at all". Set below the 1st percentile of
   * real words so coined brands pass (Kodak −3.6, Xerox −3.5, Hulu −3.5)
   * while letter salad fails (xkqzvrt −4.1, vjxkap −4.2).
   */
  isPronounceable(name: string): boolean {
    return this.logProb(name) >= this.realWordP1 - 0.75;
  }

  /**
   * Invent a word with the Markov chain, optionally starting with `prefix`.
   * Backs off to shorter contexts when a longer one was never seen.
   */
  invent(rng: Rng, maxLen: number, prefix = ''): string | null {
    let word = prefix;
    while (word.length <= maxLen) {
      const history = (BOS.repeat(3) + word).slice(-3);
      let next: Map<string, number> | undefined;
      for (let order = 3; order >= 1 && !next; order--) {
        next = this.chains[order].get(history.slice(-order));
      }
      if (!next) return null;
      const letters = [...next.keys()];
      const ch = rng.weighted(letters, [...next.values()]);
      if (ch === EOS) return word.length > prefix.length ? word : null;
      word += ch;
    }
    return null; // ran past maxLen without ending
  }

  /** Related words (WordNet synonyms) for a lexicon word. */
  relatedTo(word: string): string[] {
    return this.related[word] ?? [];
  }

  /** CMU rime ("AE S T" for fast) when the word is known. */
  rimeOf(word: string): string | undefined {
    return this.pron[word]?.[1];
  }

  /** Syllable count from CMUdict when known. */
  syllableCount(word: string): number | undefined {
    return this.pron[word]?.[0];
  }
}

let shared: Lexicon | undefined;
/** Process-wide lexicon, built on first use. */
export function getLexicon(): Lexicon {
  return (shared ??= new Lexicon());
}
