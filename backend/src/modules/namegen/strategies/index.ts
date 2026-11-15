import type { Technique } from '../types';
import type { Strategy } from './context';
import { affix } from './affix';
import { alliterate } from './alliterate';
import { blend } from './blend';
import { clip } from './clip';
import { coin } from './coin';
import { compound } from './compound';
import { markov } from './markov';
import { respell } from './respell';
import { rhyme } from './rhyme';

export const STRATEGIES: Record<Technique, Strategy> = {
  compound,
  blend,
  affix,
  clip,
  respell,
  rhyme,
  alliterate,
  coin,
  markov,
};

/** Strategies that need seed words to do anything. */
export const NEEDS_SEEDS: ReadonlySet<Technique> = new Set([
  'compound',
  'blend',
  'affix',
  'clip',
  'respell',
  'rhyme',
  'alliterate',
]);
