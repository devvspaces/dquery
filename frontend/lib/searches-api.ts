"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/config";
import { InsufficientCreditsError } from "@/lib/pricing";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import type { BackendCheckItem } from "@/lib/map-results";
import type { WordEngineConfig } from "@/lib/types";

/** Saved searches: reopen for free, refresh for credits. */

export interface SearchSummary {
  id: string;
  kind: "generate" | "check";
  title: string;
  names: number;
  tlds: string[];
  checked: number;
  available: number;
  cheapest: number | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
}

export interface SavedSearch {
  id: string;
  kind: "generate" | "check";
  title: string;
  businessName: string;
  description: string | null;
  input: {
    engine?: "ai" | "words";
    businessName?: string;
    description?: string;
    wordEngine?: WordEngineConfig;
  } | null;
  names: string[];
  techniques: Record<string, string>;
  tlds: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
  results: BackendCheckItem[];
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type DomainPair = { domain: string; tld: string };

/** Fetch with the user's token; 402 becomes InsufficientCreditsError. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useDomainQStore.getState().token;
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 402) throw new InsufficientCreditsError(body.required ?? 0, body.available ?? 0);
    const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const searchesApi = {
  list: (q = "", page = 1, limit = 20) =>
    apiFetch<Paginated<SearchSummary>>(
      `/searches?page=${page}&limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ""}`
    ),
  get: (id: string) => apiFetch<SavedSearch>(`/searches/${id}`),
  update: (id: string, patch: { title?: string; pinned?: boolean }) =>
    apiFetch<{ ok: boolean }>(`/searches/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: string) => apiFetch<{ ok: boolean }>(`/searches/${id}`, { method: "DELETE" }),
  refreshPrices: (id: string, pairs?: DomainPair[]) =>
    apiFetch<{ creditsDeducted: number; repriced: number; duplicate: boolean; results: BackendCheckItem[] }>(
      `/searches/${id}/refresh`,
      { method: "POST", body: JSON.stringify({ mode: "prices", pairs, requestId: crypto.randomUUID() }) }
    ),
  recheck: (id: string, pairs?: DomainPair[]) =>
    apiFetch<{ batchId: string; sseUrl: string; creditsDeducted: number; domains: number }>(
      `/searches/${id}/refresh`,
      { method: "POST", body: JSON.stringify({ mode: "availability", pairs, requestId: crypto.randomUUID() }) }
    ),
  moreNames: (id: string) =>
    apiFetch<{ jobId: string; creditsDeducted: number }>(`/searches/${id}/names`, {
      method: "POST",
      body: JSON.stringify({ requestId: crypto.randomUUID() }),
    }),
};

export function useSearchHistory(q = "", limit = 20) {
  const token = useDomainQStore((s) => s.token);
  return useQuery({
    queryKey: ["searches", q, limit],
    queryFn: () => searchesApi.list(q, 1, limit),
    enabled: !!token,
    staleTime: 15_000,
  });
}

/** Rename, pin and delete, refreshing the history list afterwards. */
export function useSearchActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["searches"] });
  return {
    update: useMutation({
      mutationFn: (v: { id: string; title?: string; pinned?: boolean }) =>
        searchesApi.update(v.id, { title: v.title, pinned: v.pinned }),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: (id: string) => searchesApi.remove(id), onSuccess: done }),
    invalidate: done,
  };
}
