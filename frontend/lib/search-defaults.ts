/** Names requested per generation run (the user then picks which to check). */
export const GENERATION_COUNT = 20;

/** Max TLDs per search (enforced by the backend too). */
export const MAX_TLDS = 10;

/** Max name × extension pairs per check (backend limit). */
export const MAX_CHECKS = 500;

/** TLDs offered by default in the checker. */
export const POPULAR_TLDS = [".com", ".net", ".org", ".io", ".co", ".dev", ".ai", ".app"];

export interface DomainPair {
  domain: string;
  tld: string;
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Turn a checker query plus chosen extensions into name × TLD pairs.
 *   "acme"        + [.com,.io] → acme.com, acme.io
 *   "acme.co.uk"  + [.com]     → acme.co.uk, acme.com
 * Accepts pasted URLs ("https://www.acme.com/") and ignores duplicates.
 */
export function buildCheckPairs(query: string, tlds: string[]): DomainPair[] {
  const cleaned = query
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\s+/g, "");
  if (!cleaned) return [];

  const dot = cleaned.indexOf(".");
  const name = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const typedTld = dot === -1 ? null : cleaned.slice(dot + 1);
  if (!LABEL.test(name)) return [];

  const pairs: DomainPair[] = [];
  const seen = new Set<string>();
  const add = (tld: string) => {
    const t = tld.replace(/^\./, "");
    if (!t || seen.has(t)) return;
    seen.add(t);
    pairs.push({ domain: name, tld: t });
  };
  if (typedTld) add(typedTld);
  tlds.forEach(add);
  return pairs;
}
