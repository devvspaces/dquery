"use client";

import { ArrowLeft, ChevronDown, Pencil, Plus, RefreshCw, Sparkles, Tag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/results-view";
import type { SearchMeta } from "@/lib/hooks/use-search-session";

/** What this search is, when it was checked, and what you can do with it. */
export function SummaryBar({
  meta,
  busy,
  availableCount,
  totalCount,
  onEdit,
  onMoreNames,
  onBackToNames,
  onRefreshPrices,
  onRecheck,
  onNew,
}: {
  meta: SearchMeta;
  busy: boolean;
  availableCount: number;
  totalCount: number;
  onEdit: () => void;
  onMoreNames: () => void;
  onBackToNames: () => void;
  onRefreshPrices: () => void;
  onRecheck: () => void;
  onNew: () => void;
}) {
  const generated = meta.kind === "generate";
  return (
    <div className="flex flex-col gap-3 pb-3 pt-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          {generated ? "Generated names" : "Domain check"}
        </p>
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">{meta.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {meta.names.length} name{meta.names.length === 1 ? "" : "s"} · {meta.tlds.length} extension
          {meta.tlds.length === 1 ? "" : "s"}
          {meta.lastCheckedAt ? ` · checked ${timeAgo(meta.lastCheckedAt)}` : ""}
          {meta.id ? " · saved to History" : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {generated && (
          <button type="button" onClick={onBackToNames} disabled={busy} className={btn}>
            <ArrowLeft className="h-3.5 w-3.5" /> Names
          </button>
        )}
        {generated && (
          <button type="button" onClick={onMoreNames} disabled={busy || !meta.id} className={btn}>
            <Sparkles className="h-3.5 w-3.5" /> More names
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={busy || !meta.id || totalCount === 0} className={btn}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onSelect={onRefreshPrices} disabled={availableCount === 0} className="flex-col items-start gap-0.5">
              <span className="flex items-center gap-1.5 font-medium">
                <Tag className="h-3.5 w-3.5" /> Refresh prices
              </span>
              <span className="text-xs text-muted-foreground">
                {availableCount} available domain{availableCount === 1 ? "" : "s"}, from today&apos;s price list
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRecheck} className="flex-col items-start gap-0.5">
              <span className="flex items-center gap-1.5 font-medium">
                <RefreshCw className="h-3.5 w-3.5" /> Re-check availability
              </span>
              <span className="text-xs text-muted-foreground">
                All {totalCount} domain{totalCount === 1 ? "" : "s"}, live with the registrars
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" onClick={onEdit} disabled={busy} className={btn}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button type="button" onClick={onNew} className={`${btn} border-primary/40 text-primary hover:bg-primary/10`}>
          <Plus className="h-3.5 w-3.5" /> New search
        </button>
      </div>
    </div>
  );
}

const btn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50";
