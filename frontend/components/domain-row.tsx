"use client";

import React from "react"

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { DomainResult } from "@/lib/types";
import { useDomainQStore } from "@/lib/store/use-domainq-store";

interface DomainRowProps {
  result: DomainResult;
  index: number;
}

export function DomainRow({ result, index }: DomainRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { isAuthenticated, isBookmarked, toggleBookmark } = useDomainQStore();

  const bookmarked = isBookmarked(result.domain);
  // Every registrar check failed: we don't know, which is not the same as taken.
  const unknown =
    !result.available &&
    result.prices.length > 0 &&
    result.prices.every((p) => p.status === "unknown");

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark(result.domain, result.extension, result.prices);
  };

  return (
    <div
      className="animate-fade-in group"
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all",
          result.available
            ? "border-border hover:border-primary/30 hover:bg-primary/[0.02]"
            : result.prices.length === 0
              ? "border-border bg-card hover:bg-muted/30"
              : "border-border opacity-60 hover:opacity-80",
          expanded && result.available && "border-primary/30 bg-primary/[0.02]"
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              result.available
                ? "bg-success"
                : unknown
                  ? "bg-muted-foreground"
                  : result.prices.length > 0
                    ? "bg-destructive"
                    : "bg-amber-500 animate-pulse"
            )}
          />
          <div className="flex items-baseline gap-0.5">
            <span className="font-mono text-sm font-medium text-foreground">
              {result.name}
            </span>
            <span className="font-mono text-sm text-primary">
              {result.extension}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bookmark button */}
          {isAuthenticated && result.available && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleBookmark}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleBookmark(e as unknown as React.MouseEvent);
              }}
              className={cn(
                "inline-flex items-center justify-center rounded-md p-1 transition-all",
                bookmarked
                  ? "text-primary"
                  : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
              )}
              aria-label={bookmarked ? `Remove bookmark for ${result.domain}` : `Bookmark ${result.domain}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={bookmarked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
              </svg>
            </span>
          )}

          {result.available && result.bestPrice !== null ? (
            <span className="text-sm font-medium text-foreground">
              ${result.bestPrice.toFixed(2)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                /yr
              </span>
            </span>
          ) : result.available ? (
            <span className="text-xs text-muted-foreground">Check price</span>
          ) : unknown ? (
            <span className="text-xs text-muted-foreground">Unknown</span>
          ) : result.prices.length > 0 ? (
            <span className="text-xs text-muted-foreground">Taken</span>
          ) : (
            <span className="text-xs text-amber-500 animate-pulse font-medium">Checking...</span>
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
            className={cn(
              "text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="animate-scale-in mt-1 rounded-lg border border-border bg-card p-4">
          {result.prices.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 border-b border-border pb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Registrar
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Register
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Renewal
                </span>
              </div>
              {result.prices.map((p) => (
                <div
                  key={p.registrar}
                  className="grid grid-cols-4 items-center gap-4 py-1.5"
                >
                  <span className="text-sm font-medium text-foreground">
                    {p.registrar}
                  </span>
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      p.available
                        ? "bg-success/10 text-success"
                        : p.status === "unknown"
                          ? "bg-muted text-muted-foreground"
                          : "bg-destructive/10 text-destructive"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        p.available
                          ? "bg-success"
                          : p.status === "unknown"
                            ? "bg-muted-foreground"
                            : "bg-destructive"
                      )}
                    />
                    {p.available
                      ? p.premium
                        ? "Premium"
                        : "Available"
                      : p.status === "unknown"
                        ? "Unknown"
                        : "Taken"}
                  </span>
                  <span className="text-sm text-foreground">
                    {p.registerPrice !== null
                      ? `$${p.registerPrice.toFixed(2)}`
                      : "-"}
                  </span>
                  <span
                    className="text-sm text-muted-foreground"
                    title={
                      p.threeYearTotal != null
                        ? `3-year total: $${p.threeYearTotal.toFixed(2)}`
                        : undefined
                    }
                  >
                    {p.renewalPrice !== null
                      ? `$${p.renewalPrice.toFixed(2)}`
                      : "-"}
                    {p.isPromo && (
                      <span className="ml-1 text-xs">(1st-yr promo)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              No registrar data available
            </p>
          )}
        </div>
      )}
    </div>
  );
}
