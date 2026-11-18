"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  FALLBACK_TLDS,
  filterByCategory,
  searchTlds,
  useMaxTlds,
  useTldIndex,
  type TldCategory,
  type TldEntry,
} from "@/lib/tld-index";

/** Shown without scrolling forever; typing narrows the rest. */
const VISIBLE_LIMIT = 120;

const DEFAULT_SELECTED = [".com", ".net", ".io", ".co", ".dev", ".ai"];

/** The curated list, kept for callers that need a static set. */
const ALL_TLDS = FALLBACK_TLDS.map((t) => ({ extension: `.${t.tld}`, category: t.category }));

const dot = (tld: string) => `.${tld.replace(/^\./, "")}`;
const money = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

export function TldSelector({
  selected,
  onToggle,
  max: maxOverride,
}: {
  selected: string[];
  onToggle: (tld: string) => void;
  /** Defaults to the server's per-search limit. */
  max?: number;
}) {
  const serverMax = useMaxTlds();
  const max = maxOverride ?? serverMax;
  const { entries, loaded, checkableCount } = useTldIndex();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"All" | TldCategory>("Popular");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [category, search]);

  const checkable = useMemo(() => entries.filter((e) => e.checkable), [entries]);
  const counts = useMemo(() => {
    const c = new Map<string, number>([["All", checkable.length]]);
    for (const e of checkable) c.set(e.category, (c.get(e.category) ?? 0) + 1);
    return c;
  }, [checkable]);

  // Browsing shows what we can check; a search also surfaces price-only ones, marked.
  const shown = useMemo<TldEntry[]>(
    () => (search.trim() ? searchTlds(entries, search) : filterByCategory(checkable, category)),
    [entries, checkable, category, search]
  );
  const visible = shown.slice(0, VISIBLE_LIMIT);
  const atLimit = selected.length >= max;
  const byTld = useMemo(() => new Map(entries.map((e) => [e.tld, e])), [entries]);

  const toggle = (ext: string) => {
    if (!selected.includes(ext) && atLimit) return;
    onToggle(ext);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Extensions</span>
        <span
          className={cn("text-xs font-medium tabular-nums", atLimit ? "text-warning" : "text-muted-foreground")}
          aria-live="polite"
        >
          {selected.length}/{max}
        </span>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((ext) => {
            const e = byTld.get(ext.replace(/^\./, ""));
            return (
              <button
                type="button"
                key={ext}
                onClick={() => onToggle(ext)}
                aria-label={`Remove ${ext}`}
                className="group inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                <span className="font-mono">{ext}</span>
                {e?.from != null && <span className="font-normal opacity-70">{money(e.from)}</span>}
                <X className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" aria-hidden />
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setTimeout(() => searchRef.current?.focus(), 100);
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
          open
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-input bg-background text-muted-foreground hover:text-foreground"
        )}
      >
        <span className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {open
            ? "Close extension picker"
            : checkableCount
              ? `Browse ${checkableCount.toLocaleString()} extensions`
              : "Browse & add extensions"}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                ref={searchRef}
                type="text"
                // Enter must not submit the surrounding search form.
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const first = visible.find((t) => t.checkable && !selected.includes(dot(t.tld)));
                  if (first) toggle(dot(first.tld));
                }}
                placeholder="Search: .io, shop, nigeria, co.uk…"
                aria-label="Search extensions"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {!search.trim() && (
            <div className="flex gap-0.5 overflow-x-auto border-b border-border px-2.5 py-1.5" role="tablist">
              {CATEGORIES.filter((c) => counts.get(c)).map((c) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={category === c}
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    category === c ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {c}
                  <span className="tabular-nums opacity-50">{counts.get(c)}</span>
                </button>
              ))}
            </div>
          )}

          <div ref={listRef} className="max-h-[280px] overflow-y-auto p-2.5">
            {visible.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No extensions match &ldquo;{search}&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {visible.map((t) => {
                  const ext = dot(t.tld);
                  const isSelected = selected.includes(ext);
                  const disabled = !isSelected && (atLimit || !t.checkable);
                  const title = !t.checkable
                    ? `${ext}: we have prices but can't check availability yet`
                    : t.registrars
                      ? `${ext}: ${t.registrars} registrar${t.registrars === 1 ? "" : "s"} compared`
                      : ext;
                  return (
                    <button
                      type="button"
                      key={t.tld}
                      onClick={() => toggle(ext)}
                      disabled={disabled}
                      aria-pressed={isSelected}
                      title={title}
                      className={cn(
                        "flex min-w-0 items-center justify-between gap-1 rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
                        isSelected
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : disabled
                            ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/60"
                            : "border-border bg-background text-foreground hover:border-primary/30 hover:bg-primary/5"
                      )}
                    >
                      <span className="truncate font-mono font-medium">{ext}</span>
                      {isSelected ? (
                        <Check className="h-3 w-3 shrink-0" aria-hidden />
                      ) : !t.checkable ? (
                        <span className="shrink-0 text-[10px]">prices only</span>
                      ) : t.from != null ? (
                        <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">{money(t.from)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            {shown.length > visible.length && (
              <p className="pt-2 text-center text-[11px] text-muted-foreground">
                Showing {visible.length} of {shown.length.toLocaleString()}. Keep typing to narrow it down.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-2 text-[11px]">
            <span className="text-muted-foreground">
              {loaded ? "Prices: cheapest first year we found" : "Loading all extensions…"}
            </span>
            <span className="flex items-center gap-3">
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => selected.forEach((ext) => onToggle(ext))}
                  className="font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
              <Link href="/tld" target="_blank" className="font-medium text-primary hover:underline">
                All prices →
              </Link>
            </span>
          </div>
        </div>
      )}

      {atLimit && (
        <p className="flex items-center gap-1.5 text-[11px] text-warning">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Up to {max} extensions per search. Remove one to add another.
        </p>
      )}
    </div>
  );
}

export { ALL_TLDS, DEFAULT_SELECTED };
