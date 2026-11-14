"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DomainResult, SortKey, SortDirection } from "@/lib/types";
import { DomainRow } from "@/components/domain-row";

interface ResultsTableProps {
  results: DomainResult[];
  isLoading: boolean;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "domainLength", label: "Domain length" },
  { key: "extensionLength", label: "Extension" },
  { key: "name", label: "Name" },
];

export function ResultsTable({ results, isLoading }: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [filterAvailable, setFilterAvailable] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let items = [...results];

    if (filterAvailable) {
      items = items.filter((r) => r.available);
    }

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "price": {
          const aPrice = a.bestPrice ?? Infinity;
          const bPrice = b.bestPrice ?? Infinity;
          cmp = aPrice - bPrice;
          break;
        }
        case "domainLength":
          cmp = a.domain.length - b.domain.length;
          break;
        case "extensionLength":
          cmp = a.extension.length - b.extension.length;
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [results, sortKey, sortDir, filterAvailable]);

  const availableCount = results.filter((r) => r.available).length;
  const takenCount = results.filter((r) => !r.available).length;

  if (isLoading) {
    return <ResultsSkeleton />;
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {results.length} domains found
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-muted-foreground">
                {availableCount} available
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span className="text-muted-foreground">
                {takenCount} taken
              </span>
            </span>
          </div>
        </div>

        <button
          onClick={() => setFilterAvailable((f) => !f)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
            filterAvailable
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          Available only
        </button>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Sort by</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleSort(opt.key)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
              sortKey === opt.key
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
            {sortKey === opt.key && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "transition-transform",
                  sortDir === "desc" && "rotate-180"
                )}
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Results list */}
      <div className="space-y-1.5">
        {filteredAndSorted.map((result, i) => (
          <DomainRow
            key={result.domain}
            result={result}
            index={i}
          />
        ))}
      </div>

      {filterAvailable && filteredAndSorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No available domains found. Try different keywords or extensions.
          </p>
        </div>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 rounded bg-muted animate-pulse" />
        <div className="h-6 w-28 rounded bg-muted animate-pulse" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-12 rounded bg-muted animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 w-20 rounded bg-muted animate-pulse" />
        ))}
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-muted animate-pulse"
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
    </div>
  );
}
