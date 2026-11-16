"use client";

import { memo, useState } from "react";
import { Loader2 } from "lucide-react";
import { TECHNIQUE_INFO } from "@/components/word-builder";
import { cn } from "@/lib/utils";
import type { DomainResult, Technique } from "@/lib/types";

const PAGE = 100;

function StatusText({ row }: { row: DomainResult }) {
  switch (row.status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Checking
        </span>
      );
    case "available":
      return <span className="font-medium text-success">Available</span>;
    case "taken":
      return <span className="text-muted-foreground">Taken</span>;
    case "unsupported":
      return <span className="text-muted-foreground">Not sold</span>;
    default:
      return <span className="text-warning">Couldn&apos;t check</span>;
  }
}

const Row = memo(function Row({
  row,
  selected,
  onToggle,
  onOpen,
}: {
  row: DomainResult;
  selected: boolean;
  onToggle: (domain: string) => void;
  onOpen: (row: DomainResult) => void;
}) {
  const best = row.prices.find((p) => p.available && p.registerPrice !== null);
  const technique = row.technique as Technique | undefined;
  return (
    <tr className={cn("border-b border-border/60 last:border-0 hover:bg-muted/30", selected && "bg-primary/[0.04]")}>
      <td className="w-10 px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(row.domain)}
          aria-label={`Select ${row.domain}`}
          className="accent-[hsl(var(--primary))]"
        />
      </td>
      <td className="px-2 py-2">
        <button
          type="button"
          onClick={() => onOpen(row)}
          className="font-mono text-sm text-foreground hover:text-primary focus-visible:outline-none focus-visible:underline"
        >
          {row.name}
          <span className="text-primary">{row.extension}</span>
        </button>
        {technique && TECHNIQUE_INFO[technique] && (
          <span className="ml-2 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground md:inline">
            {TECHNIQUE_INFO[technique].label}
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-xs">
        <StatusText row={row} />
      </td>
      <td className="px-2 py-2 text-right font-mono text-sm tabular-nums text-foreground">
        {row.status === "available" && row.bestPrice !== null ? `$${row.bestPrice.toFixed(2)}` : "—"}
      </td>
      <td className="hidden px-2 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground sm:table-cell">
        {best?.renewalPrice != null && row.status === "available" ? `$${best.renewalPrice.toFixed(2)}` : "—"}
      </td>
      <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">
        {row.status === "available" ? best?.registrar ?? "" : ""}
      </td>
    </tr>
  );
});

/** Flat view: one row per domain, selectable for bulk refresh. */
export function ResultsTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  rows: DomainResult[];
  selected: Set<string>;
  onToggle: (domain: string) => void;
  onToggleAll: (domains: string[], on: boolean) => void;
  onOpen: (row: DomainResult) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  const shown = rows.slice(0, limit);
  const allOn = shown.length > 0 && shown.every((r) => selected.has(r.domain));
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left" data-testid="results-table">
          <thead className="bg-muted/40">
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={() => onToggleAll(shown.map((r) => r.domain), !allOn)}
                  aria-label="Select all shown"
                  className="accent-[hsl(var(--primary))]"
                />
              </th>
              <th className="px-2 py-2 font-medium">Domain</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 text-right font-medium">1st year</th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Renewal</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Cheapest at</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <Row key={row.domain} row={row} selected={selected.has(row.domain)} onToggle={onToggle} onOpen={onOpen} />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="border-t border-border p-3 text-center">
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="text-sm text-primary hover:underline">
            Show {Math.min(PAGE, rows.length - limit)} more
          </button>
        </div>
      )}
    </div>
  );
}
