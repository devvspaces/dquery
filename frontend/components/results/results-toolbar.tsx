"use client";

import { useState } from "react";
import { LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isFiltered, NO_FILTERS, type ResultCounts, type ResultFilters, type SortMode } from "@/lib/results-view";
import type { Progress } from "@/lib/hooks/use-search-session";

export type ViewMode = "names" | "table";

const SORTS: Array<[SortMode, string]> = [
  ["original", "As listed"],
  ["cheapest", "Cheapest first"],
  ["shortest", "Shortest first"],
  ["az", "A–Z"],
  ["extension", "By extension"],
];
const PRICE_CAPS: Array<[number | null, string]> = [
  [null, "Any price"],
  [10, "Under $10"],
  [20, "Under $20"],
  [50, "Under $50"],
  [100, "Under $100"],
];

/**
 * Sticky bar over the results: live progress and counts, then the controls
 * to narrow and order a long list.
 */
export function ResultsToolbar({
  counts,
  progress,
  filters,
  onFilters,
  sort,
  onSort,
  view,
  onView,
  extensions,
  shown,
}: {
  counts: ResultCounts;
  progress: Progress;
  filters: ResultFilters;
  onFilters: (f: ResultFilters) => void;
  sort: SortMode;
  onSort: (s: SortMode) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  extensions: string[];
  shown: number;
}) {
  const [open, setOpen] = useState(false);
  const pct = counts.total ? Math.round((counts.checked / counts.total) * 100) : 0;
  const busy = progress.running || counts.pending > 0;
  const set = (patch: Partial<ResultFilters>) => onFilters({ ...filters, ...patch });
  const toggleTld = (t: string) =>
    set({ tlds: filters.tlds.includes(t) ? filters.tlds.filter((x) => x !== t) : [...filters.tlds, t] });
  const active = isFiltered(filters);

  return (
    <div className="sticky top-14 z-30 -mx-4 border-b border-border bg-background/90 px-4 pb-3 pt-3 backdrop-blur-xl">
      {/* Progress + counts */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" aria-live="polite">
        <span className="font-medium text-foreground">
          {busy ? `${counts.checked} of ${counts.total} checked` : `${counts.total} domains checked`}
        </span>
        <span className="inline-flex items-center gap-1 text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden /> {counts.available} available
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden /> {counts.taken} taken
        </span>
        {counts.unknown > 0 && (
          <span className="inline-flex items-center gap-1 text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden /> {counts.unknown} couldn&apos;t check
          </span>
        )}
        {busy && progress.message && <span className="text-muted-foreground">{progress.message}</span>}
      </div>
      {busy && (
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Checking progress"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
      )}

      {/* Controls */}
      <div className="mt-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Find in results"
            aria-label="Find in results"
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => set({ availableOnly: !filters.availableOnly })}
          aria-pressed={filters.availableOnly}
          className={cn(
            "hidden h-9 shrink-0 items-center rounded-lg border px-3 text-xs font-medium md:inline-flex",
            filters.availableOnly ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          Available only
        </button>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as SortMode)}
          aria-label="Sort"
          className="hidden h-9 shrink-0 rounded-lg border border-input bg-background px-2 text-xs md:block"
        >
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium",
            active ? "border-primary/50 text-primary" : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Filters</span>
          {active && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">on</span>}
        </button>
        <div className="flex shrink-0 rounded-lg border border-border p-0.5" role="group" aria-label="View">
          {(
            [
              ["names", LayoutGrid, "By name"],
              ["table", List, "Table"],
            ] as const
          ).map(([v, Icon, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              aria-pressed={view === v}
              title={label}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs",
                view === v ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-3" data-testid="filters-panel">
          <div className="flex flex-wrap items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => set({ availableOnly: !filters.availableOnly })}
              aria-pressed={filters.availableOnly}
              className={cn(
                "h-8 rounded-lg border px-3 text-xs font-medium",
                filters.availableOnly ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              )}
            >
              Available only
            </button>
            <select
              value={sort}
              onChange={(e) => onSort(e.target.value as SortMode)}
              aria-label="Sort (mobile)"
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
            >
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">Extensions</p>
            <div className="flex flex-wrap gap-1.5">
              {extensions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTld(t)}
                  aria-pressed={filters.tlds.includes(t)}
                  className={cn(
                    "h-7 rounded-md border px-2 font-mono text-xs",
                    filters.tlds.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Price">
              {PRICE_CAPS.map(([cap, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => set({ maxPrice: cap })}
                  aria-pressed={filters.maxPrice === cap}
                  className={cn(
                    "h-7 rounded-md border px-2 text-xs",
                    filters.maxPrice === cap ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {active && (
              <button
                type="button"
                onClick={() => onFilters(NO_FILTERS)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        </div>
      )}
      {active && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {shown} of {counts.total}
        </p>
      )}
    </div>
  );
}
