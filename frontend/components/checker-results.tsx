"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { AvailabilityPill, BuyLink, PriceText } from "@/components/offer-bits";
import type { DomainResult } from "@/lib/types";
import { useDomainQStore } from "@/lib/store/use-domainq-store";

interface CheckerResultsProps {
  results: DomainResult[];
  isLoading: boolean;
}

type PriceSortDir = "asc" | "desc";

export function CheckerResults({ results, isLoading }: CheckerResultsProps) {
  if (isLoading) {
    return <CheckerSkeleton />;
  }

  if (results.length === 0) {
    return null;
  }

  // Single domain check = 1 result, name-only check = multiple results
  const isSingleCheck = results.length === 1;

  if (isSingleCheck) {
    return <SingleDomainResult result={results[0]} />;
  }

  return <MultiTldResults results={results} />;
}

/* -------------------------------------------------- */
/* Single domain result (e.g. user typed mybiz.com)   */
/* -------------------------------------------------- */
function SingleDomainResult({ result }: { result: DomainResult }) {
  const [sortDir, setSortDir] = useState<PriceSortDir>("asc");
  const { isAuthenticated, isBookmarked, toggleBookmark } = useDomainQStore();
  const bookmarked = isBookmarked(result.domain);

  const handleBookmark = () => {
    toggleBookmark(result.domain, result.extension, result.prices);
  };

  const sortedPrices = useMemo(() => {
    const items = [...result.prices];
    items.sort((a, b) => {
      const aPrice = a.registerPrice ?? Infinity;
      const bPrice = b.registerPrice ?? Infinity;
      return sortDir === "asc" ? aPrice - bPrice : bPrice - aPrice;
    });
    return items;
  }, [result.prices, sortDir]);

  const cheapest = useMemo(() => {
    const available = result.prices.filter((p) => p.available && p.registerPrice !== null);
    if (available.length === 0) return null;
    return available.reduce((min, p) => (p.registerPrice! < min.registerPrice! ? p : min));
  }, [result.prices]);

  return (
    <div className="animate-fade-in space-y-5">
      {/* Status card */}
      <div
        className={cn(
          "rounded-xl border-2 p-5 transition-all",
          result.available
            ? "border-success/30 bg-success/[0.04]"
            : result.prices.length === 0
              ? "border-amber-500/20 bg-amber-500/[0.02]"
              : "border-destructive/30 bg-destructive/[0.04]"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                result.available
                  ? "bg-success/10 text-success"
                  : result.prices.length === 0
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-destructive/10 text-destructive"
              )}
            >
              {result.available ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : result.prices.length === 0 ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-0.5">
                <span className="font-mono text-lg font-semibold text-foreground">
                  {result.name}
                </span>
                <span className="font-mono text-lg font-semibold text-primary">
                  {result.extension}
                </span>
              </div>
              <p className={cn(
                "mt-0.5 text-sm font-medium",
                result.available 
                  ? "text-success" 
                  : result.prices.length === 0
                    ? "text-amber-500 animate-pulse"
                    : "text-destructive"
              )}>
                {result.available 
                  ? "This domain is available!" 
                  : result.prices.length === 0
                    ? "Checking domain availability..."
                    : "This domain is taken"}
              </p>
              {isAuthenticated && result.available && (
                <button
                  onClick={handleBookmark}
                  className={cn(
                    "mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all",
                    bookmarked
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill={bookmarked ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                  </svg>
                  {bookmarked ? "Bookmarked" : "Bookmark"}
                </button>
              )}
            </div>
          </div>

          {result.available && cheapest && (
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Best price</p>
              <p className="text-2xl font-semibold text-foreground tracking-tight">
                ${cheapest.registerPrice?.toFixed(2)}
                <span className="text-xs font-normal text-muted-foreground">/yr</span>
              </p>
              <p className="text-xs text-muted-foreground">{cheapest.registrar}</p>
            </div>
          )}
        </div>
      </div>

      {/* Registrar price comparison */}
      {result.prices.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Registrar prices
            </h3>
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Price
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("transition-transform", sortDir === "desc" && "rotate-180")}
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border bg-muted/30 px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Registrar
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center w-20">
              Status
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right w-20">
              Register
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right w-20">
              Renewal
            </span>
            <span className="w-14" aria-hidden />
          </div>

          {/* Table rows */}
          <div className="divide-y divide-border">
            {sortedPrices.map((p, i) => {
              const isCheapest = cheapest && p.registrar === cheapest.registrar;
              return (
                <div
                  key={p.registrar}
                  className={cn(
                    "grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 transition-colors animate-fade-in",
                    isCheapest && "bg-primary/[0.03]"
                  )}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {p.registrar}
                    </span>
                    {isCheapest && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                        Best
                      </span>
                    )}
                  </div>
                  <div className="flex justify-center w-20">
                    <AvailabilityPill offer={p} />
                  </div>
                  <span className="text-sm text-right w-20 font-mono text-foreground">
                    <PriceText amount={p.registerPrice} offer={p} />
                  </span>
                  <span className="text-sm text-right w-20 font-mono text-muted-foreground">
                    {p.renewalPrice !== null ? `$${p.renewalPrice.toFixed(2)}` : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </span>
                  <span className="w-14 text-right">
                    <BuyLink offer={p} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------- */
/* Multi-TLD results (user typed just a name)         */
/* -------------------------------------------------- */
function MultiTldResults({ results }: { results: DomainResult[] }) {
  const [sortDir, setSortDir] = useState<PriceSortDir>("asc");
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  const availableCount = results.filter((r) => r.available).length;
  const takenCount = results.filter((r) => !r.available).length;

  const sorted = useMemo(() => {
    let items = [...results];
    if (filterAvailable) {
      items = items.filter((r) => r.available);
    }
    items.sort((a, b) => {
      const aPrice = a.bestPrice ?? Infinity;
      const bPrice = b.bestPrice ?? Infinity;
      return sortDir === "asc" ? aPrice - bPrice : bPrice - aPrice;
    });
    return items;
  }, [results, sortDir, filterAvailable]);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            Checked across {results.length} extensions
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-muted-foreground">{availableCount} available</span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span className="text-muted-foreground">{takenCount} taken</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterAvailable((f) => !f)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
              filterAvailable
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
            Available only
          </button>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Price
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn("transition-transform", sortDir === "desc" && "rotate-180")}
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Domain cards */}
      <div className="space-y-2">
        {sorted.map((result, i) => {
          const isExpanded = expandedDomain === result.domain;
          const cheapest = result.prices
            .filter((p) => p.available && p.registerPrice !== null)
            .reduce<(typeof result.prices)[number] | null>(
              (min, p) => (!min || p.registerPrice! < min.registerPrice! ? p : min),
              null
            );

          return (
            <div
              key={result.domain}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <button
                onClick={() => setExpandedDomain(isExpanded ? null : result.domain)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all",
                  result.available
                    ? "border-border hover:border-primary/30 hover:bg-primary/[0.02]"
                    : result.prices.length === 0
                      ? "border-border bg-card hover:bg-muted/30"
                      : "border-border opacity-50 hover:opacity-70",
                  isExpanded && result.available && "border-primary/30 bg-primary/[0.02] rounded-b-none"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    result.available 
                      ? "bg-success" 
                      : result.prices.length === 0
                        ? "bg-amber-500 animate-pulse"
                        : "bg-destructive"
                  )} />
                  <div className="flex items-baseline gap-0.5">
                    <span className="font-mono text-sm font-semibold text-foreground">{result.name}</span>
                    <span className="font-mono text-sm font-semibold text-primary">{result.extension}</span>
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    result.available 
                      ? "text-success" 
                      : result.prices.length === 0
                        ? "text-amber-500 animate-pulse"
                        : "text-muted-foreground"
                  )}>
                    {result.available 
                      ? "Available" 
                      : result.prices.length === 0
                        ? "Checking..."
                        : "Taken"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {result.available && result.bestPrice !== null && (
                    <span className="text-sm font-semibold text-foreground">
                      ${result.bestPrice.toFixed(2)}
                      <span className="text-xs font-normal text-muted-foreground">/yr</span>
                    </span>
                  )}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn("text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="animate-scale-in rounded-b-xl border border-t-0 border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border bg-muted/30 px-4 py-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Registrar</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center w-16">Status</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right w-20">Register</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right w-20">Renewal</span>
                    <span className="w-14" aria-hidden />
                  </div>
                  <div className="divide-y divide-border">
                    {[...result.prices]
                      .sort((a, b) => (a.registerPrice ?? Infinity) - (b.registerPrice ?? Infinity))
                      .map((p) => {
                        const isBest = cheapest && p.registrar === cheapest.registrar;
                        return (
                          <div
                            key={p.registrar}
                            className={cn(
                              "grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-2.5",
                              isBest && "bg-primary/[0.03]"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{p.registrar}</span>
                              {isBest && (
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                                  Best
                                </span>
                              )}
                            </div>
                            <div className="flex justify-center w-16">
                              <AvailabilityPill offer={p} />
                            </div>
                            <span className="text-sm text-right w-20 font-mono text-foreground">
                              <PriceText amount={p.registerPrice} offer={p} />
                            </span>
                            <span className="text-sm text-right w-20 font-mono text-muted-foreground">
                              {p.renewalPrice !== null ? `$${p.renewalPrice.toFixed(2)}` : <span className="text-muted-foreground">--</span>}
                            </span>
                            <span className="w-14 text-right">
                              <BuyLink offer={p} />
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filterAvailable && sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No available domains found across these extensions.
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------- */
/* Loading skeleton                                    */
/* -------------------------------------------------- */
function CheckerSkeleton() {
  return (
    <div className="animate-fade-in space-y-5">
      {/* Status card skeleton */}
      <div className="rounded-xl border-2 border-border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-44 rounded bg-muted animate-pulse" />
              <div className="h-3 w-32 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="space-y-1.5 text-right">
            <div className="h-3 w-14 rounded bg-muted animate-pulse ml-auto" />
            <div className="h-7 w-20 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
          <div className="h-6 w-16 rounded bg-muted animate-pulse" />
        </div>
        <div className="border-b border-border bg-muted/30 px-4 py-2">
          <div className="h-3 w-full rounded bg-muted/50 animate-pulse" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="h-4 flex-1 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
            <div className="h-5 w-14 rounded-full bg-muted animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
            <div className="h-4 w-16 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
            <div className="h-4 w-16 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
