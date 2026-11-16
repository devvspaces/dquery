import type { DomainResult } from "@/lib/types";

/**
 * Pure helpers behind the results workspace: counts, filters, sorting and
 * grouping. Kept free of React so they're easy to test.
 */

export type SortMode = "original" | "cheapest" | "shortest" | "az" | "extension";

export interface ResultFilters {
  availableOnly: boolean;
  /** Extensions to show (".com"); empty = all. */
  tlds: string[];
  /** Max first-year price; null = any. */
  maxPrice: number | null;
  /** Text to find in the domain. */
  query: string;
}

export const NO_FILTERS: ResultFilters = { availableOnly: false, tlds: [], maxPrice: null, query: "" };

export interface ResultCounts {
  total: number;
  checked: number;
  pending: number;
  available: number;
  taken: number;
  unknown: number;
}

export function countResults(rows: DomainResult[]): ResultCounts {
  const c: ResultCounts = { total: rows.length, checked: 0, pending: 0, available: 0, taken: 0, unknown: 0 };
  for (const r of rows) {
    if (r.status === "pending") c.pending++;
    else {
      c.checked++;
      if (r.status === "available") c.available++;
      else if (r.status === "taken") c.taken++;
      else c.unknown++;
    }
  }
  return c;
}

export function isFiltered(f: ResultFilters): boolean {
  return f.availableOnly || f.tlds.length > 0 || f.maxPrice !== null || f.query.trim() !== "";
}

export function filterResults(rows: DomainResult[], f: ResultFilters): DomainResult[] {
  const q = f.query.trim().toLowerCase();
  const tlds = new Set(f.tlds);
  return rows.filter((r) => {
    if (f.availableOnly && r.status !== "available") return false;
    if (tlds.size && !tlds.has(r.extension)) return false;
    if (f.maxPrice !== null && (r.bestPrice === null || r.bestPrice > f.maxPrice)) return false;
    if (q && !r.domain.includes(q)) return false;
    return true;
  });
}

/** Rank for "cheapest": available by price, then pending, then the rest. */
function priceRank(r: DomainResult): number {
  if (r.status === "available") return r.bestPrice ?? 1e7;
  if (r.status === "pending") return 1e8;
  return 1e9;
}

/**
 * Sort rows. `original` keeps the order they were added (stable while results
 * stream in, so nothing jumps). Ties always fall back to the original order.
 */
export function sortResults(rows: DomainResult[], mode: SortMode): DomainResult[] {
  if (mode === "original") return rows;
  const indexed = rows.map((r, i) => [r, i] as const);
  const cmp: Record<Exclude<SortMode, "original">, (a: DomainResult, b: DomainResult) => number> = {
    cheapest: (a, b) => priceRank(a) - priceRank(b),
    shortest: (a, b) => a.domain.length - b.domain.length,
    az: (a, b) => a.domain.localeCompare(b.domain),
    extension: (a, b) => a.extension.localeCompare(b.extension) || a.name.localeCompare(b.name),
  };
  const by = cmp[mode];
  return indexed.sort(([a, i], [b, j]) => by(a, b) || i - j).map(([r]) => r);
}

export interface NameGroup {
  name: string;
  technique?: string;
  rows: DomainResult[];
  /** The cheapest available row, if any. */
  best: DomainResult | null;
  available: number;
  pending: number;
}

/**
 * One group per name, rows in extension order as first seen. Group order
 * follows the sort: by a group's best row for "cheapest", by name length for
 * "shortest", alphabetically for "az"/"extension", else as first seen.
 */
export function groupByName(rows: DomainResult[], mode: SortMode, tldOrder: string[] = []): NameGroup[] {
  const groups = new Map<string, NameGroup>();
  for (const r of rows) {
    let g = groups.get(r.name);
    if (!g) {
      g = { name: r.name, technique: r.technique, rows: [], best: null, available: 0, pending: 0 };
      groups.set(r.name, g);
    }
    g.rows.push(r);
    if (r.status === "pending") g.pending++;
    if (r.status === "available") {
      g.available++;
      if (!g.best || (r.bestPrice ?? Infinity) < (g.best.bestPrice ?? Infinity)) g.best = r;
    }
  }
  const order = new Map(tldOrder.map((t, i) => [t, i]));
  for (const g of groups.values()) {
    g.rows.sort((a, b) => (order.get(a.extension) ?? 99) - (order.get(b.extension) ?? 99));
  }
  const list = [...groups.values()];
  if (mode === "original") return list;
  const indexed = list.map((g, i) => [g, i] as const);
  const rank = (g: NameGroup) =>
    g.best ? (g.best.bestPrice ?? 1e7) : g.pending ? 1e8 : 1e9;
  const cmp: Record<Exclude<SortMode, "original">, (a: NameGroup, b: NameGroup) => number> = {
    cheapest: (a, b) => rank(a) - rank(b),
    shortest: (a, b) => a.name.length - b.name.length,
    az: (a, b) => a.name.localeCompare(b.name),
    extension: (a, b) => a.name.localeCompare(b.name),
  };
  return indexed.sort(([a, i], [b, j]) => cmp[mode](a, b) || i - j).map(([g]) => g);
}

/** Extensions present in the rows, in first-seen order. */
export function extensionsOf(rows: DomainResult[]): string[] {
  return [...new Set(rows.map((r) => r.extension))];
}

/** "2h ago" style relative time. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
