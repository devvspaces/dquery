"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/config";
import { InsufficientCreditsError } from "@/lib/pricing";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { GENERATION_COUNT, type DomainPair } from "@/lib/search-defaults";
import {
  checkedRow,
  markPending,
  mergeResults,
  type BackendCheckItem,
} from "@/lib/map-results";
import { apiFetch, searchesApi, type SavedSearch } from "@/lib/searches-api";
import type { DomainResult, GenerateRequest } from "@/lib/types";

export type Phase = "idle" | "generating" | "review" | "results";

export interface SearchMeta {
  id: string | null;
  kind: "generate" | "check";
  title: string;
  names: string[];
  techniques: Record<string, string>;
  tlds: string[];
  description?: string;
  lastCheckedAt?: string | null;
}

export interface ReviewState {
  names: string[];
  techniques: Record<string, string>;
  tlds: string[];
  /** Names to start selected (default: all). */
  selected?: string[];
}

export interface Progress {
  running: boolean;
  message: string | null;
  /** Domains finished / total in the current run. */
  done: number;
  total: number;
}

const IDLE_PROGRESS: Progress = { running: false, message: null, done: 0, total: 0 };
const dotted = (t: string) => (t.startsWith(".") ? t : `.${t}`);
const bare = (t: string) => t.replace(/^\./, "");

/** Keep `?s=<id>` in the URL so reload / Back / History reopen the search. */
function setSearchParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("s", id);
  else url.searchParams.delete("s");
  url.searchParams.delete("q");
  window.history.replaceState(window.history.state, "", url.toString());
}

/** Saved rows in a stable order: by name order, then extension order. */
export function rowsFromSaved(search: SavedSearch): DomainResult[] {
  const nameIdx = new Map(search.names.map((n, i) => [n, i]));
  const tldIdx = new Map(search.tlds.map((t, i) => [bare(t), i]));
  return [...search.results]
    .sort(
      (a, b) =>
        (nameIdx.get(a.domain) ?? 1e6) - (nameIdx.get(b.domain) ?? 1e6) ||
        (tldIdx.get(a.tld) ?? 1e6) - (tldIdx.get(b.tld) ?? 1e6)
    )
    .map((item) => checkedRow(item, search.techniques[item.domain]));
}

/**
 * Everything about the current search: generate → review → check, streaming
 * progress, saved-search loading, and the paid refresh actions.
 */
export function useSearchSession({ onInsufficientCredits }: { onInsufficientCredits: () => void }) {
  const qc = useQueryClient();
  const fetchProfile = useDomainQStore((s) => s.fetchProfile);
  const [phase, setPhase] = useState<Phase>("idle");
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [rows, setRows] = useState<DomainResult[]>([]);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [progress, setProgress] = useState<Progress>(IDLE_PROGRESS);
  const sourceRef = useRef<EventSource | null>(null);
  const metaRef = useRef<SearchMeta | null>(null);
  metaRef.current = meta;
  const rowsRef = useRef<DomainResult[]>([]);
  rowsRef.current = rows;

  const closeStream = () => {
    sourceRef.current?.close();
    sourceRef.current = null;
  };
  useEffect(() => closeStream, []);

  const afterCharge = useCallback(() => {
    fetchProfile();
    void qc.invalidateQueries({ queryKey: ["searches"] });
  }, [fetchProfile, qc]);

  const fail = useCallback(
    (err: unknown, fallback: string) => {
      setProgress(IDLE_PROGRESS);
      if (err instanceof InsufficientCreditsError) {
        onInsufficientCredits();
        return;
      }
      toast.error((err as Error)?.message || fallback);
    },
    [onInsufficientCredits]
  );

  const openStream = (sseUrl: string) => {
    closeStream();
    const token = useDomainQStore.getState().token;
    const src = new EventSource(`${API_BASE_URL}${sseUrl}${token ? `?token=${encodeURIComponent(token)}` : ""}`);
    sourceRef.current = src;
    return src;
  };

  /** Load a saved search (free) and show it. */
  const load = useCallback(
    async (id: string) => {
      closeStream();
      setMeta(null);
      setRows([]);
      setReview(null);
      setPhase("results");
      setProgress({ ...IDLE_PROGRESS, running: true, message: "Opening saved search…" });
      try {
        const s = await searchesApi.get(id);
        const m: SearchMeta = {
          id: s.id,
          kind: s.kind,
          title: s.title,
          names: s.names,
          techniques: s.techniques,
          tlds: s.tlds.map(dotted),
          description: s.input?.description ?? s.description ?? undefined,
          lastCheckedAt: s.lastCheckedAt,
        };
        setMeta(m);
        const saved = rowsFromSaved(s);
        setRows(saved);
        setSearchParam(s.id);
        if (saved.length === 0 && s.kind === "generate" && s.names.length) {
          setReview({ names: s.names, techniques: s.techniques, tlds: m.tlds });
          setPhase("review");
        } else {
          setReview(null);
          setPhase("results");
        }
        setProgress(IDLE_PROGRESS);
      } catch (err) {
        setSearchParam(null);
        setPhase("idle");
        fail(err, "Couldn't open that search");
      }
    },
    [fail]
  );

  /** Follow a check batch, laying results over rows as they arrive. */
  const followBatch = useCallback(
    (sseUrl: string, pairs: DomainPair[]) => {
      const total = pairs.length;
      setProgress({ running: true, message: "Checking registrars…", done: 0, total });
      const src = openStream(sseUrl);
      const keyOf = (p: { domain: string; tld: string }) => `${p.domain}${dotted(p.tld)}`;
      const received = new Set<string>();
      let finished = false;

      const finish = (stalled: boolean) => {
        if (finished) return;
        finished = true;
        closeStream();
        setProgress(IDLE_PROGRESS);
        afterCharge();
        const stuck = pairs.filter((p) => !received.has(keyOf(p)));
        if (stuck.length === 0) return;
        const stuckKeys = new Set(stuck.map(keyOf));
        // Rows that never came back read as "unknown", never as "taken".
        setRows((prev) =>
          prev.map((r) => (stuckKeys.has(r.domain) && r.status === "pending" ? { ...r, status: "unknown" as const } : r))
        );
        const id = metaRef.current?.id;
        const n = stuck.length;
        toast.warning(
          stalled
            ? `Lost the live connection with ${n} domain${n === 1 ? "" : "s"} still checking.`
            : `${n} check${n === 1 ? "" : "s"} didn't finish. Those credits were refunded.`,
          id
            ? stalled
              ? { action: { label: "Reload results", onClick: () => void load(id) }, duration: 15000 }
              : { action: { label: "Retry", onClick: () => void recheckRef.current?.(stuck) }, duration: 15000 }
            : undefined
        );
      };

      src.addEventListener("batch:update", (event: MessageEvent) => {
        try {
          const batch = JSON.parse(event.data) as {
            completed: number;
            failed: number;
            total: number;
            results?: BackendCheckItem[];
          };
          const items = batch.results ?? [];
          for (const i of items) received.add(keyOf(i));
          setRows((prev) => mergeResults(prev, items, metaRef.current?.techniques));
          setProgress((p) => ({ ...p, done: Math.min(received.size, total) }));
          if (batch.total > 0 && batch.completed + batch.failed >= batch.total) finish(false);
        } catch (err) {
          console.error("Bad batch event", err);
        }
      });
      src.addEventListener("error", () => finish(true));
    },
    [afterCharge, load]
  );

  /** Check name × extension pairs (charged per pair), storing them on the search. */
  const check = useCallback(
    async (pairs: DomainPair[], opts: { title?: string; fresh?: boolean; techniques?: Record<string, string> } = {}) => {
      if (pairs.length === 0) return;
      const current = opts.fresh ? null : metaRef.current;
      const techniques = opts.techniques ?? current?.techniques ?? {};
      setReview(null);
      setPhase("results");
      setRows((prev) => markPending(opts.fresh ? [] : prev, pairs, techniques));
      if (opts.fresh) {
        setMeta({
          id: null,
          kind: "check",
          title: opts.title ?? pairs[0].domain,
          names: [...new Set(pairs.map((p) => p.domain))],
          techniques: {},
          tlds: [...new Set(pairs.map((p) => dotted(p.tld)))],
        });
      } else if (current) {
        setMeta({
          ...current,
          names: [...new Set([...current.names, ...pairs.map((p) => p.domain)])],
          tlds: [...new Set([...current.tlds, ...pairs.map((p) => dotted(p.tld))])],
        });
      }
      setProgress({ running: true, message: "Starting checks…", done: 0, total: pairs.length });
      try {
        const res = await apiFetch<{ sseUrl: string; searchId: string }>("/domains/check/bulk", {
          method: "POST",
          body: JSON.stringify({ domains: pairs, searchId: current?.id ?? undefined, title: opts.title }),
        });
        setMeta((m) => (m ? { ...m, id: res.searchId } : m));
        setSearchParam(res.searchId);
        afterCharge();
        followBatch(res.sseUrl, pairs);
      } catch (err) {
        setRows((prev) => prev.filter((r) => r.status !== "pending"));
        fail(err, "Couldn't start the checks");
      }
    },
    [afterCharge, fail, followBatch]
  );

  /** Follow a generation job to completion, then show the review step. */
  const followGeneration = useCallback(
    (sseUrl: string, words: boolean, tlds: string[], onDone?: (names: string[], techniques: Record<string, string>, searchId: string) => void) => {
      const src = openStream(sseUrl);
      src.addEventListener("job:active", () =>
        setProgress((p) => ({ ...p, message: words ? "Blending, combining and scoring names…" : "AI is crafting names…" }))
      );
      src.addEventListener("job:completed", (event: MessageEvent) => {
        closeStream();
        setProgress(IDLE_PROGRESS);
        try {
          const { result } = JSON.parse(event.data);
          const names = (result.domains ?? []) as string[];
          const techniques = (result.techniques ?? {}) as Record<string, string>;
          const searchId = result.searchHistoryId as string;
          afterCharge();
          if (onDone) onDone(names, techniques, searchId);
          else {
            setReview({ names, techniques, tlds });
            setPhase("review");
          }
        } catch (err) {
          fail(err, "Couldn't read the generated names");
        }
      });
      src.addEventListener("job:failed", () => {
        closeStream();
        setProgress(IDLE_PROGRESS);
        setPhase(metaRef.current?.id && rowsRef.current.length ? "results" : "idle");
        toast.error("Name generation failed. Your credits were refunded.");
        afterCharge();
      });
      src.addEventListener("error", () => {
        closeStream();
        setProgress(IDLE_PROGRESS);
        const id = metaRef.current?.id;
        toast.error("Lost the connection while generating.", id ? { action: { label: "Reopen search", onClick: () => void load(id) } } : undefined);
      });
    },
    [afterCharge, fail, load]
  );

  /** Generate names only (generation fee); the user reviews them next. */
  const generate = useCallback(
    async (data: GenerateRequest) => {
      const words = data.engine === "words";
      closeStream();
      setRows([]);
      setReview(null);
      setPhase("generating");
      setProgress({ ...IDLE_PROGRESS, running: true, message: words ? "Building names from your words…" : "Generating name ideas…" });
      const title = words ? (data.wordEngine?.seeds ?? []).join(" ") || "Invented names" : data.businessName || data.description.slice(0, 60);
      try {
        const res = await apiFetch<{ sseUrl: string }>("/domains/generate", {
          method: "POST",
          body: JSON.stringify({
            engine: data.engine,
            autoCheck: false,
            ...(words
              ? { wordEngine: data.wordEngine }
              : { businessName: data.businessName, description: data.description, style: "creative" }),
            count: GENERATION_COUNT,
            tlds: data.tlds.map(bare),
          }),
        });
        afterCharge();
        followGeneration(res.sseUrl, words, data.tlds, (names, techniques, searchId) => {
          setMeta({ id: searchId, kind: "generate", title, names, techniques, tlds: data.tlds.map(dotted), description: data.description });
          setSearchParam(searchId);
          setReview({ names, techniques, tlds: data.tlds.map(dotted) });
          setPhase("review");
        });
      } catch (err) {
        setPhase("idle");
        fail(err, "Couldn't start name generation");
      }
    },
    [afterCharge, fail, followGeneration]
  );

  /** Re-read prices from today's catalog for these rows (or all). */
  const refreshPrices = useCallback(
    async (pairs?: DomainPair[]) => {
      const id = metaRef.current?.id;
      if (!id) return;
      setProgress({ running: true, message: "Refreshing prices…", done: 0, total: pairs?.length ?? 0 });
      try {
        const res = await searchesApi.refreshPrices(id, pairs);
        setRows((prev) => mergeResults(prev, res.results, metaRef.current?.techniques));
        setProgress(IDLE_PROGRESS);
        afterCharge();
        toast.success(
          res.repriced
            ? `Updated prices for ${res.repriced} available domain${res.repriced === 1 ? "" : "s"}.`
            : "No available domains to re-price, so nothing was charged."
        );
      } catch (err) {
        fail(err, "Couldn't refresh prices");
      }
    },
    [afterCharge, fail]
  );

  /** Re-check availability live for these rows (or all). */
  const recheck = useCallback(
    async (pairs?: DomainPair[]) => {
      const id = metaRef.current?.id;
      if (!id) return;
      const targets =
        pairs ?? rowsRef.current.map((r) => ({ domain: r.name, tld: bare(r.extension) }));
      setRows((prev) => markPending(prev, targets));
      setPhase("results");
      try {
        const res = await searchesApi.recheck(id, pairs);
        afterCharge();
        followBatch(res.sseUrl, targets);
      } catch (err) {
        void load(id);
        fail(err, "Couldn't start the re-check");
      }
    },
    [afterCharge, fail, followBatch, load]
  );
  const recheckRef = useRef(recheck);
  recheckRef.current = recheck;

  /** More names for this search (generation fee), then review just the new ones. */
  const moreNames = useCallback(async () => {
    const current = metaRef.current;
    if (!current?.id) return;
    setPhase("generating");
    setProgress({ ...IDLE_PROGRESS, running: true, message: "Finding new names…" });
    try {
      const res = await searchesApi.moreNames(current.id);
      afterCharge();
      followGeneration(`/api/domains/jobs/${res.jobId}/stream`, false, current.tlds, (names, techniques) => {
        setMeta((m) =>
          m
            ? { ...m, names: [...new Set([...m.names, ...names])], techniques: { ...m.techniques, ...techniques } }
            : m
        );
        if (names.length === 0) {
          toast.info("No new names this time. Try different words or settings.");
          setPhase(rowsRef.current.length ? "results" : "idle");
          return;
        }
        setReview({ names, techniques, tlds: current.tlds });
        setPhase("review");
      });
    } catch (err) {
      setPhase(rowsRef.current.length ? "results" : "review");
      fail(err, "Couldn't generate more names");
    }
  }, [afterCharge, fail, followGeneration]);

  /** Back from results to the name list; checked names start unselected. */
  const backToNames = useCallback(() => {
    const m = metaRef.current;
    if (!m) return;
    const checked = new Set(rowsRef.current.map((r) => r.name));
    setReview({
      names: m.names,
      techniques: m.techniques,
      tlds: m.tlds,
      selected: m.names.filter((n) => !checked.has(n)),
    });
    setPhase("review");
  }, []);

  /** Leave the current search (it stays saved). */
  const reset = useCallback(() => {
    closeStream();
    setPhase("idle");
    setMeta(null);
    setRows([]);
    setReview(null);
    setProgress(IDLE_PROGRESS);
    setSearchParam(null);
  }, []);

  return {
    phase,
    setPhase,
    meta,
    rows,
    review,
    progress,
    generate,
    check,
    load,
    refreshPrices,
    recheck,
    moreNames,
    backToNames,
    reset,
  };
}
