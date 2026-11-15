"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface TLD {
  extension: string;
  category: string;
  popular?: boolean;
}

const ALL_TLDS: TLD[] = [
  // Popular
  { extension: ".com", category: "Popular", popular: true },
  { extension: ".net", category: "Popular", popular: true },
  { extension: ".org", category: "Popular", popular: true },
  { extension: ".io", category: "Popular", popular: true },
  { extension: ".co", category: "Popular", popular: true },
  { extension: ".dev", category: "Popular", popular: true },
  { extension: ".ai", category: "Popular", popular: true },
  { extension: ".app", category: "Popular", popular: true },
  // Tech
  { extension: ".tech", category: "Tech" },
  { extension: ".codes", category: "Tech" },
  { extension: ".software", category: "Tech" },
  { extension: ".systems", category: "Tech" },
  { extension: ".digital", category: "Tech" },
  { extension: ".cloud", category: "Tech" },
  { extension: ".data", category: "Tech" },
  { extension: ".network", category: "Tech" },
  { extension: ".api", category: "Tech" },
  { extension: ".compute", category: "Tech" },
  // Business
  { extension: ".biz", category: "Business" },
  { extension: ".company", category: "Business" },
  { extension: ".agency", category: "Business" },
  { extension: ".consulting", category: "Business" },
  { extension: ".services", category: "Business" },
  { extension: ".solutions", category: "Business" },
  { extension: ".group", category: "Business" },
  { extension: ".team", category: "Business" },
  { extension: ".enterprises", category: "Business" },
  { extension: ".partners", category: "Business" },
  { extension: ".ventures", category: "Business" },
  { extension: ".capital", category: "Business" },
  // Creative
  { extension: ".design", category: "Creative" },
  { extension: ".studio", category: "Creative" },
  { extension: ".art", category: "Creative" },
  { extension: ".media", category: "Creative" },
  { extension: ".gallery", category: "Creative" },
  { extension: ".photography", category: "Creative" },
  { extension: ".graphics", category: "Creative" },
  { extension: ".creative", category: "Creative" },
  // Web & Online
  { extension: ".site", category: "Web" },
  { extension: ".online", category: "Web" },
  { extension: ".xyz", category: "Web" },
  { extension: ".web", category: "Web" },
  { extension: ".info", category: "Web" },
  { extension: ".me", category: "Web" },
  { extension: ".page", category: "Web" },
  { extension: ".link", category: "Web" },
  { extension: ".space", category: "Web" },
  { extension: ".website", category: "Web" },
  // Commerce
  { extension: ".store", category: "Commerce" },
  { extension: ".shop", category: "Commerce" },
  { extension: ".market", category: "Commerce" },
  { extension: ".buy", category: "Commerce" },
  { extension: ".sale", category: "Commerce" },
  { extension: ".deals", category: "Commerce" },
  { extension: ".discount", category: "Commerce" },
  { extension: ".boutique", category: "Commerce" },
  // Region
  { extension: ".us", category: "Region" },
  { extension: ".uk", category: "Region" },
  { extension: ".eu", category: "Region" },
  { extension: ".ca", category: "Region" },
  { extension: ".de", category: "Region" },
  { extension: ".fr", category: "Region" },
  { extension: ".in", category: "Region" },
  { extension: ".au", category: "Region" },
  { extension: ".jp", category: "Region" },
  { extension: ".br", category: "Region" },
];

const CATEGORIES = [
  "All",
  "Popular",
  "Tech",
  "Business",
  "Creative",
  "Web",
  "Commerce",
  "Region",
] as const;

type SortMode = "default" | "shortest" | "longest";

const MAX_SELECTIONS = 20;

const DEFAULT_SELECTED = [".com", ".net", ".io", ".co", ".dev", ".ai"];

export function TldSelector({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (tld: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [isExpanded, setIsExpanded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll when category/search changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeCategory, search, sortMode]);

  const filteredTlds = useMemo(() => {
    let tlds = ALL_TLDS;

    // Category filter
    if (activeCategory !== "All") {
      tlds = tlds.filter((t) => t.category === activeCategory);
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase().replace(/^\./, "");
      tlds = tlds.filter((t) =>
        t.extension.toLowerCase().replace(/^\./, "").includes(q)
      );
    }

    // Sort
    if (sortMode === "shortest") {
      tlds = [...tlds].sort(
        (a, b) => a.extension.length - b.extension.length
      );
    } else if (sortMode === "longest") {
      tlds = [...tlds].sort(
        (a, b) => b.extension.length - a.extension.length
      );
    }

    return tlds;
  }, [activeCategory, search, sortMode]);

  const atLimit = selected.length >= MAX_SELECTIONS;

  const handleToggle = (ext: string) => {
    if (!selected.includes(ext) && atLimit) return;
    onToggle(ext);
  };

  const cycleSortMode = () => {
    setSortMode((prev) => {
      if (prev === "default") return "shortest";
      if (prev === "shortest") return "longest";
      return "default";
    });
  };

  // Selected TLDs shown as compact chips at top
  const selectedTlds = ALL_TLDS.filter((t) => selected.includes(t.extension));

  return (
    <div className="space-y-3">
      {/* Header with count and limit */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Extensions
        </label>
        <span
          className={cn(
            "text-xs font-medium tabular-nums transition-colors",
            atLimit ? "text-warning" : "text-muted-foreground"
          )}
        >
          {selected.length}/{MAX_SELECTIONS}
        </span>
      </div>

      {/* Selected TLDs - always visible as compact row */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTlds.map((tld) => (
            <button
              type="button"
              key={tld.extension}
              onClick={() => onToggle(tld.extension)}
              className="group inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary transition-all hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
            >
              {tld.extension}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-60 group-hover:opacity-100"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Expand/collapse toggle */}
      <button
              type="button"
        onClick={() => {
          setIsExpanded(!isExpanded);
          if (!isExpanded) {
            setTimeout(() => searchRef.current?.focus(), 100);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-all",
          isExpanded
            ? "border-primary/30 bg-primary/5 text-foreground"
            : "border-input bg-background text-muted-foreground hover:border-border hover:text-foreground"
        )}
      >
        <span className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8" />
            <path d="M8 12h8" />
          </svg>
          {isExpanded ? "Close extension picker" : "Browse & add extensions"}
        </span>
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
            "transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Expanded picker panel */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isExpanded ? "max-h-[480px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="rounded-lg border border-border bg-card">
          {/* Search + Sort bar */}
          <div className="flex items-center gap-2 border-b border-border p-2.5">
            <div className="relative flex-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                onKeyDown={(e) => {
                  // Enter must not submit the surrounding search form.
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder="Search extensions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
              {search && (
                <button
              type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sort button */}
            <button
              type="button"
              onClick={cycleSortMode}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-xs font-medium transition-all shrink-0",
                sortMode !== "default"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-input bg-background text-muted-foreground hover:text-foreground"
              )}
              title="Sort by extension length"
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
                <path d="m3 16 4 4 4-4" />
                <path d="M7 20V4" />
                <path d="M11 4h4" />
                <path d="M11 8h7" />
                <path d="M11 12h10" />
              </svg>
              {sortMode === "default"
                ? "Length"
                : sortMode === "shortest"
                  ? "Shortest"
                  : "Longest"}
            </button>
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border px-2.5 py-1.5 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const count =
                cat === "All"
                  ? ALL_TLDS.length
                  : ALL_TLDS.filter((t) => t.category === cat).length;
              return (
                <button
              type="button"
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                    activeCategory === cat
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {cat}
                  <span
                    className={cn(
                      "tabular-nums",
                      activeCategory === cat
                        ? "opacity-60"
                        : "opacity-40"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* TLD grid */}
          <div
            ref={scrollRef}
            className="max-h-[260px] overflow-y-auto p-2.5"
          >
            {filteredTlds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground/50 mb-2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <p className="text-xs text-muted-foreground">
                  No extensions found for &quot;{search}&quot;
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {filteredTlds.map((tld) => {
                  const isSelected = selected.includes(tld.extension);
                  const isDisabled = !isSelected && atLimit;
                  return (
                    <button
              type="button"
                      key={tld.extension}
                      onClick={() => handleToggle(tld.extension)}
                      disabled={isDisabled}
                      className={cn(
                        "relative flex items-center justify-between rounded-md border px-2.5 py-2 text-xs font-medium transition-all",
                        isSelected
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : isDisabled
                            ? "cursor-not-allowed border-border bg-muted/50 text-muted-foreground/40"
                            : "border-border bg-background text-foreground hover:border-primary/20 hover:bg-primary/5"
                      )}
                    >
                      <span className="font-mono">{tld.extension}</span>
                      {isSelected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-primary shrink-0"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                      {tld.popular && !isSelected && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with quick actions */}
          <div className="flex items-center justify-between border-t border-border px-2.5 py-2">
            <span className="text-[10px] text-muted-foreground">
              {filteredTlds.length} extension{filteredTlds.length !== 1 && "s"} shown
            </span>
            <div className="flex items-center gap-2">
              <button
              type="button"
                onClick={() => {
                  // Select all visible (up to limit)
                  const remaining = MAX_SELECTIONS - selected.length;
                  const toAdd = filteredTlds
                    .filter((t) => !selected.includes(t.extension))
                    .slice(0, remaining);
                  for (const t of toAdd) {
                    onToggle(t.extension);
                  }
                }}
                disabled={atLimit || filteredTlds.every((t) => selected.includes(t.extension))}
                className="text-[10px] font-medium text-primary hover:text-primary/80 disabled:text-muted-foreground/40 disabled:cursor-not-allowed transition-colors"
              >
                Select visible
              </button>
              <span className="text-muted-foreground/30">|</span>
              <button
              type="button"
                onClick={() => {
                  // Deselect all visible
                  for (const t of filteredTlds) {
                    if (selected.includes(t.extension)) {
                      onToggle(t.extension);
                    }
                  }
                }}
                disabled={filteredTlds.every(
                  (t) => !selected.includes(t.extension)
                )}
                className="text-[10px] font-medium text-muted-foreground hover:text-foreground disabled:text-muted-foreground/40 disabled:cursor-not-allowed transition-colors"
              >
                Deselect visible
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Limit warning */}
      {atLimit && (
        <p className="flex items-center gap-1.5 text-[11px] text-warning animate-fade-in">
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
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          Maximum {MAX_SELECTIONS} extensions reached. Remove some to add more.
        </p>
      )}
    </div>
  );
}

export { ALL_TLDS, DEFAULT_SELECTED };
