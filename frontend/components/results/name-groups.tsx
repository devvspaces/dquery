"use client";

import { memo, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { TECHNIQUE_INFO } from "@/components/word-builder";
import { cn } from "@/lib/utils";
import type { NameGroup } from "@/lib/results-view";
import type { DomainResult, Technique } from "@/lib/types";

const PAGE = 30;

/** One extension of a name: its price when free, otherwise its status. */
export const DomainChip = memo(function DomainChip({
  row,
  best,
  onOpen,
}: {
  row: DomainResult;
  best: boolean;
  onOpen: (row: DomainResult) => void;
}) {
  const label =
    row.status === "available"
      ? row.bestPrice !== null
        ? `$${row.bestPrice.toFixed(2)}`
        : "Free"
      : row.status === "pending"
        ? "Checking"
        : row.status === "taken"
          ? "Taken"
          : row.status === "unsupported"
            ? "N/A"
            : "Unknown";

  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      aria-label={`${row.domain}: ${label}${best ? ", cheapest" : ""}`}
      className={cn(
        "group inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        row.status === "available" &&
          (best
            ? "border-primary bg-primary/10 text-foreground hover:bg-primary/15"
            : "border-primary/30 bg-primary/[0.04] text-foreground hover:border-primary/60"),
        row.status === "pending" && "border-dashed border-border text-muted-foreground",
        row.status === "taken" && "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
        (row.status === "unknown" || row.status === "unsupported") &&
          "border-warning/40 text-muted-foreground hover:text-foreground"
      )}
    >
      <span className={cn("font-mono font-medium", row.status === "taken" && "line-through decoration-muted-foreground/60")}>
        {row.extension}
      </span>
      {row.status === "pending" ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <span className={cn("tabular-nums", row.status === "available" ? "font-semibold text-primary" : "")}>{label}</span>
      )}
      {best && <Star className="h-3 w-3 fill-primary text-primary" aria-hidden />}
    </button>
  );
});

const GroupCard = memo(function GroupCard({
  group,
  onOpen,
}: {
  group: NameGroup;
  onOpen: (row: DomainResult) => void;
}) {
  const technique = group.technique as Technique | undefined;
  const checked = group.rows.length - group.pending;
  return (
    <li className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="truncate font-mono text-base font-semibold text-foreground">{group.name}</h3>
          {technique && TECHNIQUE_INFO[technique] && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {TECHNIQUE_INFO[technique].label}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {group.pending > 0 && checked === 0
            ? "Checking…"
            : group.available > 0
              ? `${group.available} of ${group.rows.length} free${group.best?.bestPrice != null ? ` · from $${group.best.bestPrice.toFixed(2)}` : ""}`
              : group.pending > 0
                ? `${checked} of ${group.rows.length} checked`
                : "None free"}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.rows.map((row) => (
          <DomainChip key={row.domain} row={row} best={group.best === row} onOpen={onOpen} />
        ))}
      </div>
    </li>
  );
});

/** Results as one card per name (about 6× fewer rows than a flat list). */
export function NameGroupList({
  groups,
  onOpen,
}: {
  groups: NameGroup[];
  onOpen: (row: DomainResult) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  const shown = groups.slice(0, limit);
  return (
    <div>
      <ul className="grid gap-3 lg:grid-cols-2" data-testid="name-groups">
        {shown.map((g) => (
          <GroupCard key={g.name} group={g} onOpen={onOpen} />
        ))}
      </ul>
      {groups.length > limit && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Show {Math.min(PAGE, groups.length - limit)} more names
          </button>
        </div>
      )}
    </div>
  );
}
