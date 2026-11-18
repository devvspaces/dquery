"use client";

import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/config";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { MAX_TLDS } from "@/lib/search-defaults";

/** Every priced extension, as served by GET /api/public/tld-index. */

export type TldCategory = "Popular" | "Tech" | "Business" | "Creative" | "Commerce" | "Country" | "Other";

export interface TldEntry {
  /** Without the dot: "com", "com.ng". */
  tld: string;
  /** Cheapest first-year price in USD. */
  from: number | null;
  registrars: number;
  category: TldCategory;
  /** Availability can be checked live (otherwise we only have prices). */
  checkable: boolean;
}

export interface TldIndex {
  count: number;
  checkable: number;
  tlds: TldEntry[];
}

const fallback = (tlds: string[], category: TldCategory): TldEntry[] =>
  tlds.map((tld) => ({ tld, from: null, registrars: 0, category, checkable: true }));

/** Shown while the index loads, or if it can't be fetched. */
export const FALLBACK_TLDS: TldEntry[] = [
  ...fallback(["com", "net", "org", "io", "co", "ai", "dev", "app", "xyz", "me", "info"], "Popular"),
  ...fallback(["tech", "cloud", "digital", "software", "online", "site"], "Tech"),
  ...fallback(["biz", "company", "agency", "group", "pro"], "Business"),
  ...fallback(["design", "studio", "art", "media", "blog"], "Creative"),
  ...fallback(["store", "shop", "market"], "Commerce"),
  ...fallback(["us", "uk", "co.uk", "ca", "de", "eu", "in", "ng", "com.ng"], "Country"),
];

export const CATEGORIES: Array<"All" | TldCategory> = [
  "Popular",
  "Tech",
  "Business",
  "Creative",
  "Commerce",
  "Country",
  "Other",
  "All",
];

/** Country names (and a few common words) → their ccTLD, so "nigeria" finds .ng. */
export const COUNTRY_ALIASES: Record<string, string> = {
  nigeria: "ng", ghana: "gh", kenya: "ke", "south africa": "za", egypt: "eg", morocco: "ma", uganda: "ug",
  tanzania: "tz", rwanda: "rw", "united kingdom": "uk", britain: "uk", england: "uk", "great britain": "uk",
  ireland: "ie", "united states": "us", usa: "us", america: "us", canada: "ca", mexico: "mx", brazil: "br",
  argentina: "ar", chile: "cl", colombia: "co", peru: "pe", germany: "de", france: "fr", spain: "es",
  italy: "it", netherlands: "nl", holland: "nl", belgium: "be", switzerland: "ch", austria: "at",
  portugal: "pt", poland: "pl", sweden: "se", norway: "no", denmark: "dk", finland: "fi", iceland: "is",
  greece: "gr", turkey: "tr", russia: "ru", ukraine: "ua", "czech republic": "cz", czechia: "cz",
  romania: "ro", hungary: "hu", india: "in", pakistan: "pk", bangladesh: "bd", china: "cn",
  "hong kong": "hk", taiwan: "tw", japan: "jp", korea: "kr", "south korea": "kr", singapore: "sg",
  malaysia: "my", indonesia: "id", philippines: "ph", vietnam: "vn", thailand: "th", australia: "au",
  "new zealand": "nz", israel: "il", uae: "ae", "united arab emirates": "ae", "saudi arabia": "sa",
  qatar: "qa", europe: "eu", asia: "asia", africa: "africa",
};

const clean = (q: string) => q.trim().toLowerCase().replace(/^\.+/, "");

/**
 * Extensions matching a search: exact first, then prefix, then contains,
 * plus every ccTLD (and its second levels) whose country name matches.
 */
export function searchTlds(entries: TldEntry[], query: string): TldEntry[] {
  const q = clean(query);
  if (!q) return entries;
  const countries = new Set(
    Object.entries(COUNTRY_ALIASES)
      .filter(([name]) => name.startsWith(q) || (q.length >= 4 && name.includes(q)))
      .map(([, cc]) => cc)
  );
  const score = (e: TldEntry) => {
    const top = e.tld.split(".").pop()!;
    if (e.tld === q) return 0;
    if (countries.has(e.tld)) return 1;
    if (e.tld.startsWith(q)) return 2;
    if (countries.has(top)) return 3;
    if (e.tld.includes(q)) return 4;
    return -1;
  };
  return entries
    .map((e, i) => ({ e, i, s: score(e) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.e);
}

export function filterByCategory(entries: TldEntry[], category: "All" | TldCategory): TldEntry[] {
  return category === "All" ? entries : entries.filter((e) => e.category === category);
}

export async function fetchTldIndex(): Promise<TldIndex> {
  const res = await fetch(`${API_BASE_URL}/api/public/tld-index`);
  if (!res.ok) throw new Error(`Extension list failed (${res.status})`);
  return (await res.json()) as TldIndex;
}

/** The picker's extension list: live from the catalog, curated fallback meanwhile. */
export function useTldIndex() {
  const query = useQuery({
    queryKey: ["tld-index"],
    queryFn: fetchTldIndex,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
  return {
    entries: query.data?.tlds.length ? query.data.tlds : FALLBACK_TLDS,
    loaded: !!query.data?.tlds.length,
    count: query.data?.count ?? null,
    checkableCount: query.data?.checkable ?? null,
  };
}

/** Most extensions one search may use: the server's setting, or the default until it loads. */
export function useMaxTlds(): number {
  return useDomainQStore((s) => s.pricing?.maxTlds) ?? MAX_TLDS;
}
