"use client";

import React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CostNote } from "@/components/cost-note";
import { TldSelector, DEFAULT_SELECTED } from "@/components/tld-selector";
import { estimateChecks } from "@/lib/pricing";
import { buildCheckPairs, MAX_TLDS } from "@/lib/search-defaults";

interface CheckerFormProps {
  /** The typed name or domain plus the extensions to check it across. */
  onCheck: (query: string, tlds: string[]) => void;
  isLoading: boolean;
  /** Prefilled name or domain, e.g. from the landing page's search box. */
  initialDomain?: string;
}

export function CheckerForm({ onCheck, isLoading, initialDomain = "" }: CheckerFormProps) {
  const [domain, setDomain] = useState(initialDomain);
  const [selectedTlds, setSelectedTlds] = useState<string[]>(DEFAULT_SELECTED);

  const pairs = buildCheckPairs(domain, selectedTlds);
  const tooManyTlds = selectedTlds.length > MAX_TLDS;
  const isValid = pairs.length > 0 && !tooManyTlds;

  const handleToggleTld = (tld: string) =>
    setSelectedTlds((prev) => (prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onCheck(domain.trim().toLowerCase(), selectedTlds);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="domain" className="text-sm font-medium text-foreground">
          Domain name
        </label>
        <input
          id="domain"
          type="text"
          placeholder="example or example.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Type a name (e.g. mybusiness) or a full domain (e.g. mybusiness.com). We check it across the
          extensions you pick below; a typed extension is always included.
        </p>
      </div>

      <TldSelector selected={selectedTlds} onToggle={handleToggleTld} />

      <Button type="submit" disabled={!isValid || isLoading} className="h-10 w-full text-sm font-medium">
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse_dot" />
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse_dot" style={{ animationDelay: "0.2s" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse_dot" style={{ animationDelay: "0.4s" }} />
            </span>
            Checking...
          </span>
        ) : pairs.length > 1 ? (
          `Check ${pairs.length} domains`
        ) : (
          "Check availability"
        )}
      </Button>
      {tooManyTlds ? (
        <p className="text-center text-xs text-destructive">Pick at most {MAX_TLDS} extensions.</p>
      ) : (
        pairs.length > 0 && (
          <CostNote
            cost={(p) => estimateChecks(p, pairs.length)}
            detail={pairs.map((d) => `${d.domain}.${d.tld}`).slice(0, 4).join(", ") + (pairs.length > 4 ? ` +${pairs.length - 4} more` : "")}
          />
        )
      )}
    </form>
  );
}
