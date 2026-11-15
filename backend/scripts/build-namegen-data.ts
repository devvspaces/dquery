/**
 * Builds the word engine's compact data files from open datasets.
 *
 *   npx ts-node scripts/build-namegen-data.ts <raw-dir>
 *
 * <raw-dir> must contain (download once; see src/modules/namegen/data/SOURCES.md):
 *   cmudict.dict       CMU Pronouncing Dictionary            (BSD-2)
 *   en_50k.txt         hermitdave/FrequencyWords 2018 en     (CC BY-SA 4.0)
 *   ldnoobw_en.txt     LDNOOBW English list                  (CC BY 4.0)
 *   wn/package/dict/   Princeton WordNet 3.1 (wordnet-db)    (WordNet licence)
 *
 * Output: src/modules/namegen/data/{lexicon,pron,related,blocklist}.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const raw = process.argv[2];
if (!raw) {
  console.error('usage: build-namegen-data.ts <raw-dir>');
  process.exit(1);
}
const out = join(__dirname, '..', 'src', 'modules', 'namegen', 'data');
const read = (f: string) => readFileSync(join(raw, f), 'utf8');

const LEXICON_SIZE = 30_000;
const RELATED_FOR = 15_000;
const RELATED_MAX = 8;

// --- Blocklist -------------------------------------------------------------
const blocklist = [
  ...new Set(
    read('ldnoobw_en.txt')
      .split('\n')
      .map((w) => w.trim().toLowerCase())
      .filter((w) => /^[a-z]+$/.test(w)),
  ),
].sort();
const blocked = new Set(blocklist);

// --- CMUdict ---------------------------------------------------------------
const cmu = new Map<string, string[]>();
for (const line of read('cmudict.dict').split('\n')) {
  const m = /^([a-z']+)(?:\(\d+\))?\s+(.+?)(?:\s+#.*)?$/.exec(line.trim());
  if (!m || cmu.has(m[1])) continue; // keep the first pronunciation
  cmu.set(m[1], m[2].split(' '));
}

// --- Lexicon: frequent, alphabetic, pronounceable (in CMUdict), not blocked --
const lexicon: string[] = [];
for (const line of read('en_50k.txt').split('\n')) {
  const word = line.split(' ')[0]?.trim();
  if (!word || !/^[a-z]{2,12}$/.test(word)) continue;
  if (!cmu.has(word) || blocked.has(word)) continue;
  lexicon.push(word);
  if (lexicon.length >= LEXICON_SIZE) break;
}
const inLexicon = new Set(lexicon);

// --- Pronunciation: [syllables, rime, onset] per lexicon word ---------------
const isVowel = (p: string) => /\d$/.test(p);
const pron: Record<string, [number, string, string]> = {};
for (const word of lexicon) {
  const phones = cmu.get(word)!;
  const vowels = phones.map((p, i) => (isVowel(p) ? i : -1)).filter((i) => i >= 0);
  if (!vowels.length) continue;
  const stressed = [...vowels].reverse().find((i) => phones[i].endsWith('1'));
  const rimeStart = stressed ?? vowels[vowels.length - 1];
  const rime = phones.slice(rimeStart).map((p) => p.replace(/\d/, '')).join(' ');
  const onset = phones.slice(0, vowels[0]).join(' ');
  pron[word] = [vowels.length, rime, onset];
}

// --- Related words from WordNet synsets ------------------------------------
const related = new Map<string, Set<string>>();
const addRel = (a: string, b: string) => {
  if (a === b || !inLexicon.has(a) || !inLexicon.has(b)) return;
  if (b.length > 10) return;
  if (!related.has(a)) related.set(a, new Set());
  related.get(a)!.add(b);
};
const synsets = new Map<string, string[]>(); // "pos:offset" -> members
const similar: Array<[string, string]> = []; // adjective "similar to" links
for (const pos of ['noun', 'verb', 'adj', 'adv']) {
  for (const line of read(`wn/package/dict/data.${pos}`).split('\n')) {
    if (!/^\d{8} /.test(line)) continue;
    const parts = line.split(' | ')[0].split(' ');
    const offset = parts[0];
    const count = parseInt(parts[3], 16);
    const members: string[] = [];
    for (let i = 0; i < count; i++) {
      const lemma = parts[4 + i * 2].toLowerCase().replace(/\(.*\)$/, '');
      if (/^[a-z]+$/.test(lemma)) members.push(lemma);
    }
    const key = `${pos}:${offset}`;
    synsets.set(key, members);
    let p = 4 + count * 2;
    const ptrCount = parseInt(parts[p], 10);
    p += 1;
    for (let i = 0; i < ptrCount; i++, p += 4) {
      if (parts[p] === '&') similar.push([key, `${pos}:${parts[p + 1]}`]);
    }
  }
}
// Only a word's most common senses (index files list synsets by frequency),
// so "cloud" relates to "mist", not "sully".
const TOP_SENSES = 2;
const ssKey = { noun: 'noun', verb: 'verb', adj: 'adj', adv: 'adv' } as const;
for (const pos of Object.keys(ssKey) as Array<keyof typeof ssKey>) {
  for (const line of read(`wn/package/dict/index.${pos}`).split('\n')) {
    if (line.startsWith(' ') || !line.trim()) continue;
    const parts = line.trim().split(/\s+/);
    const lemma = parts[0];
    if (!inLexicon.has(lemma)) continue;
    const pCnt = parseInt(parts[3], 10);
    const offsets = parts.slice(4 + pCnt + 2).filter((x) => /^\d{8}$/.test(x));
    for (const offset of offsets.slice(0, TOP_SENSES)) {
      const key = `${pos}:${offset}`;
      for (const b of synsets.get(key) ?? []) addRel(lemma, b);
      for (const [from, to] of similar) {
        if (from !== key) continue;
        for (const b of synsets.get(to) ?? []) addRel(lemma, b);
      }
    }
  }
}
const rank = new Map(lexicon.map((w, i) => [w, i]));
const relatedOut: Record<string, string[]> = {};
for (const word of lexicon.slice(0, RELATED_FOR)) {
  const set = related.get(word);
  if (!set) continue;
  relatedOut[word] = [...set]
    .sort((a, b) => rank.get(a)! - rank.get(b)!)
    .slice(0, RELATED_MAX);
}

// --- Write -----------------------------------------------------------------
const write = (name: string, data: unknown) => {
  const json = JSON.stringify(data);
  writeFileSync(join(out, name), json);
  console.log(`${name}: ${(json.length / 1024).toFixed(0)} KB`);
};
write('lexicon.json', lexicon);
write('pron.json', pron);
write('related.json', relatedOut);
write('blocklist.json', blocklist);
console.log(
  `lexicon=${lexicon.length} pron=${Object.keys(pron).length} related=${Object.keys(relatedOut).length} blocklist=${blocklist.length}`,
);
