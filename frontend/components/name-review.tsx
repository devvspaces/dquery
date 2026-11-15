"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CostNote } from "@/components/cost-note";
import { TldSelector } from "@/components/tld-selector";
import { TECHNIQUE_INFO } from "@/components/word-builder";
import { estimateChecks } from "@/lib/pricing";
import { MAX_CHECKS, MAX_TLDS, type DomainPair } from "@/lib/search-defaults";
import type { Technique } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ReviewState {
  names: string[];
  techniques: Record<string, string>;
  tlds: string[];
}

interface NameReviewProps {
  review: ReviewState;
  isLoading: boolean;
  onCheck: (pairs: DomainPair[], techniques: Record<string, string>) => void;
  onBack: () => void;
}

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Step between generating and checking: keep the names you like, drop the
 * rest, add your own, adjust extensions, then pay only for what you check.
 */
export function NameReview({ review, isLoading, onCheck, onBack }: NameReviewProps) {
  const [names, setNames] = useState<string[]>(review.names);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(review.names));
  const [tlds, setTlds] = useState<string[]>(review.tlds);
  const [custom, setCustom] = useState("");
  const [showTlds, setShowTlds] = useState(false);

  const chosen = names.filter((n) => selected.has(n));
  const pairs = useMemo<DomainPair[]>(
    () => chosen.flatMap((domain) => tlds.map((t) => ({ domain, tld: t.replace(/^\./, "") }))),
    [chosen, tlds]
  );
  const tooMany = pairs.length > MAX_CHECKS || tlds.length > MAX_TLDS;

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const remove = (name: string) => {
    setNames((prev) => prev.filter((n) => n !== name));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  };

  const addCustom = (e: FormEvent) => {
    e.preventDefault();
    const name = custom.trim().toLowerCase().replace(/\..*$/, "").replace(/\s+/g, "");
    if (!LABEL.test(name)) return;
    if (!names.includes(name)) setNames((prev) => [name, ...prev]);
    setSelected((prev) => new Set(prev).add(name));
    setCustom("");
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4" data-testid="name-review">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Pick the names to check</h2>
          <p className="text-xs text-muted-foreground">
            {chosen.length} of {names.length} selected. Only the names you check are charged.
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set(names))}>
            Select all
          </button>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
            Select none
          </button>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {names.map((name) => {
          const on = selected.has(name);
          const technique = review.techniques[name] as Technique | undefined;
          return (
            <li
              key={name}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors",
                on ? "border-primary/40 bg-primary/[0.04]" : "border-border opacity-60"
              )}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(name)}
                aria-label={`Select ${name}`}
                className="accent-[hsl(var(--primary))]"
              />
              <button type="button" onClick={() => toggle(name)} className="flex-1 truncate text-left font-mono text-sm text-foreground">
                {name}
              </button>
              {technique && TECHNIQUE_INFO[technique] && (
                <span className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
                  {TECHNIQUE_INFO[technique].label}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(name)}
                aria-label={`Remove ${name}`}
                className="px-1 text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      <form onSubmit={addCustom} className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Add your own name…"
          aria-label="Add your own name"
          className="h-9 flex-1 rounded-lg border border-input bg-background px-3 font-mono text-sm"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!LABEL.test(custom.trim().toLowerCase().replace(/\..*$/, ""))}>
          Add
        </Button>
      </form>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Extensions:</span>
          {tlds.map((t) => (
            <span key={t} className="rounded-md bg-muted px-2 py-0.5 font-mono text-foreground">
              {t}
            </span>
          ))}
          <button type="button" className="text-primary hover:underline" onClick={() => setShowTlds((v) => !v)}>
            {showTlds ? "Done" : "Change"}
          </button>
        </div>
        {showTlds && (
          <TldSelector
            selected={tlds}
            onToggle={(tld) => setTlds((prev) => (prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld]))}
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onBack} disabled={isLoading}>
            Back
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={pairs.length === 0 || tooMany || isLoading}
            onClick={() => onCheck(pairs, review.techniques)}
          >
            {isLoading
              ? "Checking..."
              : `Check ${chosen.length} name${chosen.length === 1 ? "" : "s"} × ${tlds.length} extension${tlds.length === 1 ? "" : "s"}`}
          </Button>
        </div>
        {tooMany ? (
          <p className="text-center text-xs text-destructive">
            Too many checks at once (max {MAX_TLDS} extensions and {MAX_CHECKS} domains). Deselect some.
          </p>
        ) : (
          pairs.length > 0 && <CostNote cost={(p) => estimateChecks(p, pairs.length)} detail={`${pairs.length} domains`} />
        )}
      </div>
    </div>
  );
}
