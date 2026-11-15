import { NamegenService } from '../namegen.service';
import { getLexicon } from '../lexicon';
import { rejectReason } from '../filters';
import { blendPair } from '../strategies/blend';
import { fillPattern } from '../strategies/coin';
import { respellWord } from '../strategies/respell';
import { joinParts, syllabify } from '../phonology';
import { Rng } from '../rng';

const svc = new NamegenService();
const lex = getLexicon();

describe('phonology', () => {
  it('splits syllables sensibly', () => {
    expect(syllabify('ledger')).toEqual(['led', 'ger']);
    expect(syllabify('banana')).toEqual(['ba', 'na', 'na']);
    expect(syllabify('make')).toEqual(['make']);
  });
  it('joins parts without awkward seams', () => {
    expect(joinParts('nova', 'app')).toBe('novapp');
    expect(joinParts('happy', 'ify')).toBe('happify');
    expect(joinParts('cure', 'ify')).toBe('curify');
  });
});

describe('strategies', () => {
  it('blends breakfast + lunch into brunch', () => {
    expect(blendPair('breakfast', 'lunch')).toContain('brunch');
  });
  it('respells like Flickr and Lyft', () => {
    expect(respellWord('flicker')).toContain('flickr');
    expect(respellWord('lift')).toContain('lyft');
  });
  it('fills syllable templates exactly', () => {
    const rng = new Rng(42);
    for (let i = 0; i < 50; i++) {
      const name = fillPattern('CVCV', rng)!;
      expect(name).toMatch(/^[^aeiou][aeiou][^aeiou][aeiou]$/);
    }
  });
});

describe('filters', () => {
  const cfg = svc.normalize({ seeds: ['x'], maxLen: 30 });
  const check = (name: string, technique: 'coin' | 'compound' = 'compound') =>
    rejectReason({ name, technique }, cfg, lex);

  it('rejects profanity inside names, including across join points', () => {
    const bad = lex.blocklist.find((w) => w.length >= 4)!;
    expect(check(`zo${bad}ly`)).toBe('blocked');
  });
  it('rejects famous brands and one-letter variants of them', () => {
    expect(check('spotify')).toBe('brand');
    expect(check('spotifi')).toBe('brand');
  });
  it('rejects unpronounceable strings and stutters', () => {
    expect(check('xkqzvrt')).not.toBeNull();
    expect(check('ledledger')).toBe('shape');
  });
  it('rejects dictionary words for invented-name techniques', () => {
    expect(check('table', 'coin')).toBe('real-word');
  });
});

describe('scoring', () => {
  it('lets coined brands through but not letter salad', () => {
    for (const ok of ['kodak', 'xerox', 'hulu', 'zillow']) {
      expect(lex.isPronounceable(ok)).toBe(true);
    }
    for (const bad of ['xkqzvrt', 'vjxkap', 'qwrtyp']) {
      expect(lex.isPronounceable(bad)).toBe(false);
    }
  });

  it('rates real-looking names as more pronounceable than random strings', () => {
    expect(lex.pronounceability('ledgera')).toBeGreaterThan(
      lex.pronounceability('xqdgrlt'),
    );
  });
});

describe('NamegenService.generate', () => {
  it('is deterministic for the same config and seed', () => {
    const a = svc.generate({ seeds: ['ledger'], count: 10, seed: 7 });
    const b = svc.generate({ seeds: ['ledger'], count: 10, seed: 7 });
    expect(a).toEqual(b);
  });

  it('returns the requested number of unique, valid names', () => {
    const names = svc.generate({ seeds: ['Ayo', 'ledger'], count: 20 });
    expect(names).toHaveLength(20);
    expect(new Set(names.map((n) => n.name)).size).toBe(20);
    for (const n of names) expect(n.name).toMatch(/^[a-z]{4,12}$/);
  });

  it('gives every seed a fair share of the results', () => {
    const names = svc.generate({ seeds: ['ayo', 'ledger'], count: 20 });
    expect(names.filter((n) => n.name.includes('ayo')).length).toBeGreaterThan(
      3,
    );
  });

  it('respects the chosen techniques and length range', () => {
    const names = svc.generate({
      seeds: ['cloud'],
      strategies: ['affix'],
      minLen: 6,
      maxLen: 9,
      count: 10,
    });
    for (const n of names) {
      expect(n.technique).toBe('affix');
      expect(n.name.length).toBeGreaterThanOrEqual(6);
      expect(n.name.length).toBeLessThanOrEqual(9);
    }
  });

  it('uses custom suffixes', () => {
    const names = svc.generate({
      seeds: ['ayo'],
      strategies: ['affix'],
      suffixes: ['zilla'],
      useBuiltInAffixes: false,
      count: 5,
    });
    expect(names.map((n) => n.name)).toContain('ayozilla');
  });

  it('invents names with no seeds at all', () => {
    const names = svc.generate({ seeds: [], count: 10 });
    expect(names.length).toBe(10);
    expect(names.every((n) => ['coin', 'markov'].includes(n.technique))).toBe(
      true,
    );
  });

  it('is fast once warm', () => {
    const start = Date.now();
    svc.generate({ seeds: ['fast', 'pay'], count: 30 });
    expect(Date.now() - start).toBeLessThan(500);
  });
});
