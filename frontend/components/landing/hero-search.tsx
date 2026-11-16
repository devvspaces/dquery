"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Mode = "generate" | "check";

const COPY: Record<Mode, { placeholder: string; cta: string; label: string }> = {
  generate: {
    placeholder: "Describe your business, e.g. eco-friendly coffee delivery",
    cta: "Find names",
    label: "Describe your business",
  },
  check: {
    placeholder: "Type a name or domain, e.g. brightloop.io",
    cta: "Compare prices",
    label: "Name or domain to check",
  },
};

/** "/search?q=acme" or "/search?tab=check&q=acme.io": the tool prefills, never auto-runs. */
export function searchHref(mode: Mode, query: string): string {
  const params = new URLSearchParams();
  if (mode === "check") params.set("tab", "check");
  const q = query.trim().slice(0, 500);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

/**
 * The page's one main action: a search box like any other (Jakob's law),
 * with the two jobs as chips rather than a menu (Hick's law).
 */
export function HeroSearch({
  defaultMode = "generate",
  id = "hero",
  compact = false,
}: {
  defaultMode?: Mode;
  id?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [query, setQuery] = useState("");
  const copy = COPY[mode];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    router.push(searchHref(mode, query));
  };

  return (
    <form onSubmit={submit} className="w-full" role="search" aria-label="Find a domain">
      <div className="mb-3 flex justify-center gap-1.5 sm:justify-start" role="tablist" aria-label="What do you want to do?">
        {(["generate", "check"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              mode === m
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "generate" ? "Generate names" : "Check a domain"}
          </button>
        ))}
      </div>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-2xl border border-border bg-card/80 p-2 shadow-[0_0_0_1px_hsl(var(--primary)/0.04),0_20px_60px_-20px_hsl(var(--primary)/0.35)] backdrop-blur sm:flex-row",
          "focus-within:border-primary/60"
        )}
      >
        <label htmlFor={`${id}-q`} className="sr-only">
          {copy.label}
        </label>
        <input
          id={`${id}-q`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.placeholder}
          autoComplete="off"
          maxLength={500}
          className={cn(
            "min-w-0 flex-1 rounded-xl bg-transparent px-4 text-foreground placeholder:text-muted-foreground focus:outline-none",
            compact ? "h-11 text-sm" : "h-12 text-base",
            mode === "check" && "font-mono"
          )}
        />
        <button
          type="submit"
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            compact ? "h-11 text-sm" : "h-12 text-base"
          )}
        >
          {copy.cta}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </form>
  );
}
