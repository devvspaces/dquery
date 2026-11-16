"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Tag, X } from "lucide-react";
import { NameGroupList } from "@/components/results/name-groups";
import { ResultsTable } from "@/components/results/results-table";
import { ResultsToolbar, type ViewMode } from "@/components/results/results-toolbar";
import { DomainDetail } from "@/components/results/domain-detail";
import { SummaryBar } from "@/components/results/summary-bar";
import { RefreshConfirm, type RefreshMode, type RefreshRequest } from "@/components/results/refresh-confirm";
import {
  countResults,
  extensionsOf,
  filterResults,
  groupByName,
  NO_FILTERS,
  sortResults,
  type ResultFilters,
  type SortMode,
} from "@/lib/results-view";
import type { Progress, SearchMeta } from "@/lib/hooks/use-search-session";
import type { DomainPair } from "@/lib/search-defaults";
import type { DomainResult } from "@/lib/types";

const VIEW_KEY = "dquery:results-view";
const pairOf = (r: DomainResult): DomainPair => ({ domain: r.name, tld: r.extension.replace(/^\./, "") });

/** The full-width results screen: summary, sticky toolbar, cards or table, detail panel. */
export function ResultsWorkspace({
  meta,
  rows,
  progress,
  onEdit,
  onNew,
  onMoreNames,
  onBackToNames,
  onRefreshPrices,
  onRecheck,
}: {
  meta: SearchMeta;
  rows: DomainResult[];
  progress: Progress;
  onEdit: () => void;
  onNew: () => void;
  onMoreNames: () => void;
  onBackToNames: () => void;
  onRefreshPrices: (pairs?: DomainPair[]) => void;
  onRecheck: (pairs?: DomainPair[]) => void;
}) {
  const [filters, setFilters] = useState<ResultFilters>(NO_FILTERS);
  const [sort, setSort] = useState<SortMode>("original");
  const [view, setView] = useState<ViewMode>("names");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<RefreshRequest | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "names" || v === "table") setView(v);
    } catch {
      // Storage unavailable: keep the default view.
    }
  }, []);
  const changeView = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Not critical.
    }
  };

  const counts = useMemo(() => countResults(rows), [rows]);
  const extensions = useMemo(() => {
    const seen = extensionsOf(rows);
    return [...meta.tlds.filter((t) => seen.includes(t)), ...seen.filter((t) => !meta.tlds.includes(t))];
  }, [rows, meta.tlds]);
  const visible = useMemo(() => sortResults(filterResults(rows, filters), sort), [rows, filters, sort]);
  const groups = useMemo(() => groupByName(visible, sort, extensions), [visible, sort, extensions]);
  const openRow = openDomain ? rows.find((r) => r.domain === openDomain) ?? null : null;
  const busy = progress.running;
  const canRefresh = !!meta.id && !busy;

  const ask = (mode: RefreshMode, target?: DomainResult[]) => {
    const list = target ?? rows;
    const count = mode === "prices" ? list.filter((r) => r.status === "available").length : list.length;
    setConfirm({ mode, pairs: target?.map(pairOf), count });
  };
  const run = (r: RefreshRequest) => {
    setConfirm(null);
    if (r.mode === "prices") onRefreshPrices(r.pairs);
    else onRecheck(r.pairs);
  };
  const selectedRows = rows.filter((r) => selected.has(r.domain));

  return (
    <div>
      <SummaryBar
        meta={meta}
        busy={busy}
        availableCount={counts.available}
        totalCount={rows.length}
        onEdit={onEdit}
        onNew={onNew}
        onMoreNames={onMoreNames}
        onBackToNames={onBackToNames}
        onRefreshPrices={() => ask("prices")}
        onRecheck={() => ask("availability")}
      />
      <ResultsToolbar
        counts={counts}
        progress={progress}
        filters={filters}
        onFilters={setFilters}
        sort={sort}
        onSort={setSort}
        view={view}
        onView={changeView}
        extensions={extensions}
        shown={visible.length}
      />

      {selected.size > 0 && view === "table" && (
        <div className="sticky bottom-4 z-20 mx-auto mt-3 flex w-fit flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
          <span className="text-xs font-medium text-foreground">{selected.size} selected</span>
          <button
            type="button"
            disabled={!canRefresh || !selectedRows.some((r) => r.status === "available")}
            onClick={() => ask("prices", selectedRows)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs disabled:opacity-50"
          >
            <Tag className="h-3.5 w-3.5" /> Refresh prices
          </button>
          <button
            type="button"
            disabled={!canRefresh}
            onClick={() => ask("availability", selectedRows)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Re-check
          </button>
          <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-4">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-foreground">{rows.length ? "Nothing matches these filters." : "No domains checked yet."}</p>
            {rows.length > 0 && (
              <button type="button" onClick={() => setFilters(NO_FILTERS)} className="mt-2 text-sm text-primary hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : view === "names" ? (
          <NameGroupList groups={groups} onOpen={(r) => setOpenDomain(r.domain)} />
        ) : (
          <ResultsTable
            rows={visible}
            selected={selected}
            onOpen={(r) => setOpenDomain(r.domain)}
            onToggle={(d) =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(d)) next.delete(d);
                else next.add(d);
                return next;
              })
            }
            onToggleAll={(domains, on) =>
              setSelected((prev) => {
                const next = new Set(prev);
                for (const d of domains) {
                  if (on) next.add(d);
                  else next.delete(d);
                }
                return next;
              })
            }
          />
        )}
      </div>

      <DomainDetail
        row={openRow}
        canRefresh={canRefresh}
        onClose={() => setOpenDomain(null)}
        onRefresh={(mode, row) => ask(mode, [row])}
      />
      <RefreshConfirm request={confirm} onCancel={() => setConfirm(null)} onConfirm={run} />
    </div>
  );
}
