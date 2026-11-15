/** Letter-level phonology helpers: vowels, syllables, joins and slot inventories. */

export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** 'y' is a vowel unless it starts the word or follows a vowel ("yes", "boy"). */
export function isVowelAt(word: string, i: number): boolean {
  const c = word[i];
  if (VOWELS.has(c)) return true;
  if (c !== 'y') return false;
  return i > 0 && !VOWELS.has(word[i - 1]);
}

/** Legal English word-initial two-consonant clusters. */
export const ONSET_CLUSTERS = [
  'bl',
  'br',
  'ch',
  'cl',
  'cr',
  'dr',
  'fl',
  'fr',
  'gl',
  'gr',
  'kl',
  'kr',
  'ph',
  'pl',
  'pr',
  'sc',
  'sh',
  'sk',
  'sl',
  'sm',
  'sn',
  'sp',
  'st',
  'sw',
  'th',
  'tr',
  'tw',
  'wh',
  'wr',
];
const ONSET_SET = new Set(ONSET_CLUSTERS);

/** Clusters that read well between two vowels (medial). */
export const MEDIAL_CLUSTERS = [
  'nd',
  'nt',
  'st',
  'rk',
  'ld',
  'mp',
  'nk',
  'rt',
  'rd',
  'rn',
  'lt',
  'lv',
  'ns',
  'nv',
  'mb',
  'sk',
  'sp',
  'ft',
  'ct',
  'ck',
  'll',
  'ss',
  'tt',
  'pp',
  'tr',
  'br',
  'gr',
  'pl',
  'cl',
  'fl',
  'dr',
  'vr',
  'zm',
  'xt',
];

/** Clusters allowed at the end of a word. */
export const CODA_CLUSTERS = [
  'nd',
  'nt',
  'st',
  'sk',
  'rk',
  'rt',
  'ld',
  'lt',
  'mp',
  'nk',
  'ft',
  'ct',
  'ck',
  'sh',
  'th',
  'rn',
  'lm',
  'rm',
  'rs',
  'ks',
];

export const SINGLE_ONSETS = 'bcdfghjklmnprstvwz'.split('');
export const SINGLE_CODAS = 'bdfgklmnprstxz'.split('');

/** Sound symbolism (Klink 2000; Lowrey & Shrum 2007). */
export const LIGHT_VOWELS = ['i', 'e', 'y'];
export const STRONG_VOWELS = ['o', 'u', 'a'];
export const LIGHT_CONSONANTS = ['f', 's', 'v', 'z', 'l', 'h'];
export const STRONG_CONSONANTS = ['b', 'd', 'g', 'k', 'p', 't'];

const SPLIT_BEFORE_DIGRAPH = new Set(['ch', 'sh', 'th', 'ph', 'wh']);

/**
 * Orthographic syllabification, good enough for clipping and blending:
 * V-CV, VC-CV, and keep legal onset clusters together (a-pron, mon-ster).
 */
export function syllabify(word: string): string[] {
  const w = word.toLowerCase();
  // Vowel groups: [start, end) index ranges.
  const groups: Array<[number, number]> = [];
  for (let i = 0; i < w.length; i++) {
    if (!isVowelAt(w, i)) continue;
    const start = i;
    while (i + 1 < w.length && isVowelAt(w, i + 1)) i++;
    groups.push([start, i + 1]);
  }
  // A final silent "e" after a consonant (make, stone) isn't a syllable.
  if (
    groups.length > 1 &&
    w.endsWith('e') &&
    groups[groups.length - 1][0] === w.length - 1 &&
    !isVowelAt(w, w.length - 2) &&
    !w.endsWith('le')
  ) {
    groups.pop();
  }
  if (groups.length <= 1) return [w];

  const cuts: number[] = [];
  for (let g = 0; g < groups.length - 1; g++) {
    const from = groups[g][1];
    const to = groups[g + 1][0];
    const cluster = w.slice(from, to);
    let cut: number;
    if (cluster.length === 0) cut = from;
    else if (cluster.length === 1) cut = from;
    else if (cluster.length === 2) {
      if (SPLIT_BEFORE_DIGRAPH.has(cluster)) cut = from;
      else if (cluster === 'ck') cut = to;
      else cut = from + 1;
    } else {
      cut = ONSET_SET.has(cluster.slice(-2)) ? to - 2 : to - 1;
    }
    cuts.push(cut);
  }
  const out: string[] = [];
  let prev = 0;
  for (const c of cuts) {
    out.push(w.slice(prev, c));
    prev = c;
  }
  out.push(w.slice(prev));
  return out.filter(Boolean);
}

/** Leading consonants of a word ("str" in "stream"); "" if it starts with a vowel. */
export function onsetOf(word: string): string {
  let i = 0;
  while (i < word.length && !isVowelAt(word, i)) i++;
  return word.slice(0, i);
}

/**
 * Join two parts so the seam reads naturally:
 * drop a doubled vowel (nova+app -> novapp), a silent e before a vowel
 * (cure+ify -> curify), and turn y into i before i (happy+ify -> happify).
 */
export function joinParts(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  const last = a[a.length - 1];
  const first = b[0];
  if (VOWELS.has(last) && last === first) return a + b.slice(1);
  if (last === 'e' && VOWELS.has(first) && a.length > 3)
    return a.slice(0, -1) + b;
  if (last === 'y' && first === 'i' && a.length > 3) return a.slice(0, -1) + b;
  return a + b;
}

/** ASCII-fold and lowercase; keeps letters, digits and inner hyphens. */
export function normalizeSeed(seed: string): string[] {
  return seed
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
}

/** Levenshtein distance, early-exiting once it exceeds `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
