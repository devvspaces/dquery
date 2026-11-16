# Word engine data sources

Built by `backend/scripts/build-namegen-data.ts` (lexicon, pron, related, blocklist).
`affixes.json` and `brands.json` are hand-curated for DQuery.

| File           | Source                                                                                                                                           | Licence                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| lexicon.json   | Top 30k words of [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles 2018, en_50k), kept only if in CMUdict | CC BY-SA 4.0 (Hermit Dave)                  |
| pron.json      | [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict): syllables, stressed rime, onset                                              | BSD-2-Clause, © Carnegie Mellon University  |
| related.json   | [Princeton WordNet 3.1](https://wordnet.princeton.edu/) via the `wordnet-db` npm package: synonyms of each word's two most common senses         | WordNet 3.0 licence, © Princeton University |
| blocklist.json | [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) English list                                         | CC BY 4.0                                   |

Attribution for these sources should also appear on the site's About/credits page.
