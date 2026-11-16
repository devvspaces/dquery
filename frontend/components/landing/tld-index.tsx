"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicTldSummary } from "@/lib/public-api";

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Every priced extension, filterable, with its cheapest first-year and 3-year prices. */
export function TldIndex({ tlds }: { tlds: PublicTldSummary[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"popular" | "cheapest">("popular");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^\./, "");
    const list = needle ? tlds.filter((t) => t.tld.includes(needle)) : tlds;
    return sort === "cheapest" ? [...list].sort((a, b) => a.cheapestThreeYear - b.cheapestThreeYear) : list;
  }, [tlds, q, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="tld-filter" className="sr-only">Filter extensions</label>
        <input
          id="tld-filter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter, e.g. .io"
          className="h-10 flex-1 rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-sm" role="group" aria-label="Sort">
          {(["popular", "cheapest"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => setSort(s)}
              className={`rounded-md px-3 py-1.5 ${sort === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {s === "popular" ? "Most compared" : "Cheapest 3-yr"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{rows.length} extensions</p>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Extension</th>
              <th scope="col" className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Registrars</th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium">From</th>
              <th scope="col" className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Renewal from</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Best 3-yr</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 400).map((t) => (
              <tr key={t.tld} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                <th scope="row" className="px-4 py-2 text-left">
                  <Link href={`/tld/${t.tld}`} className="font-mono font-medium text-foreground hover:text-primary">
                    .{t.tld}
                  </Link>
                </th>
                <td className="hidden px-2 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">{t.registrars}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums text-foreground">{usd(t.cheapestRegister)}</td>
                <td className="hidden px-2 py-2 text-right font-mono tabular-nums text-muted-foreground sm:table-cell">{usd(t.cheapestRenewal)}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums text-primary">{usd(t.cheapestThreeYear)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 400 && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Showing 400 of {rows.length}. Filter to find more.</p>}
      </div>
    </div>
  );
}
