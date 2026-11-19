"use client";

import { Bookmark, BookmarkCheck, RefreshCw, Tag } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/components/ui/use-mobile";
import { AvailabilityPill, BuyLink, PriceText } from "@/components/offer-bits";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { timeAgo } from "@/lib/results-view";
import { cn } from "@/lib/utils";
import type { DomainResult } from "@/lib/types";
import type { RefreshMode } from "@/components/results/refresh-confirm";

const STATUS_COPY: Record<DomainResult["status"], string> = {
  available: "Available to register",
  taken: "Already registered",
  pending: "Checking now…",
  unknown: "We couldn't confirm this one. Re-check to try again.",
  unsupported: "None of our registrars sell this extension.",
};

/** A domain's registrar prices, Buy links, bookmark and refresh actions. */
export function DomainDetail({
  row,
  canRefresh,
  onClose,
  onRefresh,
}: {
  row: DomainResult | null;
  canRefresh: boolean;
  onClose: () => void;
  onRefresh: (mode: RefreshMode, row: DomainResult) => void;
}) {
  const mobile = useIsMobile();
  const isAuthenticated = useDomainQStore((s) => s.isAuthenticated);
  const isBookmarked = useDomainQStore((s) => s.isBookmarked);
  const toggleBookmark = useDomainQStore((s) => s.toggleBookmark);
  const bookmarks = useDomainQStore((s) => s.bookmarks);
  void bookmarks; // re-render when bookmarks change

  const offers = row
    ? [...row.prices].sort(
        (a, b) =>
          Number(b.available) - Number(a.available) ||
          (a.threeYearTotal ?? a.registerPrice ?? Infinity) - (b.threeYearTotal ?? b.registerPrice ?? Infinity)
      )
    : [];
  const saved = row ? isBookmarked(row.domain) : false;

  return (
    <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className={cn("flex flex-col gap-0 p-0", mobile ? "max-h-[85vh] rounded-t-2xl" : "w-full sm:max-w-lg")}
      >
        {row && (
          <>
            <SheetHeader className="border-b border-border p-5 text-left">
              <SheetTitle className="break-all font-mono text-xl">
                {row.name}
                <span className="text-primary">{row.extension}</span>
              </SheetTitle>
              <SheetDescription>{STATUS_COPY[row.status]}</SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {isAuthenticated && row.status === "available" && (
                  <button
                    type="button"
                    onClick={() => toggleBookmark(row.domain, row.extension, row.prices)}
                    aria-pressed={saved}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium",
                      saved ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                    {saved ? "Saved" : "Save"}
                  </button>
                )}
                {canRefresh && row.status === "available" && (
                  <button
                    type="button"
                    onClick={() => onRefresh("prices", row)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Tag className="h-3.5 w-3.5" /> Refresh prices
                  </button>
                )}
                {canRefresh && row.status !== "pending" && (
                  <button
                    type="button"
                    onClick={() => onRefresh("availability", row)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Re-check
                  </button>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-5">
              {row.viaRegistry && row.status !== "pending" && (
                <p
                  className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                  data-testid="registry-note"
                >
                  Availability from the registry&apos;s public lookup, as no registrar could check this extension live.
                  Premium or reserved names can still be refused at checkout.
                </p>
              )}
              {offers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {row.status === "pending" ? "Prices appear here as registrars answer." : "No registrar prices for this domain."}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 font-medium">Registrar</th>
                      <th className="pb-2 text-right font-medium">1st yr</th>
                      <th className="pb-2 text-right font-medium">Renew</th>
                      <th className="hidden pb-2 text-right font-medium sm:table-cell">3 yrs</th>
                      <th className="pb-2" aria-label="Buy" />
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((p, i) => (
                      <tr key={p.registrar} className={cn("border-b border-border/60 last:border-0", i === 0 && p.available && "bg-primary/[0.05]")}>
                        <td className="py-2.5 pr-2">
                          <div className="font-medium text-foreground">{p.registrar}</div>
                          {!p.available && <AvailabilityPill offer={p} />}
                          {p.isPromo && p.available && <span className="text-[10px] text-warning">first-year promo</span>}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums">
                          <PriceText amount={p.registerPrice} offer={p} />
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right font-mono tabular-nums",
                            p.renewalPrice !== null && p.registerPrice !== null && p.renewalPrice > p.registerPrice * 1.5
                              ? "text-warning"
                              : "text-muted-foreground"
                          )}
                        >
                          {p.renewalPrice !== null ? `$${p.renewalPrice.toFixed(2)}` : "—"}
                        </td>
                        <td className="hidden py-2.5 text-right font-mono tabular-nums text-foreground sm:table-cell">
                          {p.threeYearTotal != null ? `$${p.threeYearTotal.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <BuyLink offer={p} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {(row.checkedAt || row.pricedAt) && (
              <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                Availability checked {timeAgo(row.checkedAt)}
                {row.pricedAt && row.pricedAt !== row.checkedAt ? ` · prices updated ${timeAgo(row.pricedAt)}` : ""}
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
