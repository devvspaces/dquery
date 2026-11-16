"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { estimateChecks, estimatePriceRefresh, formatCredits } from "@/lib/pricing";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import type { DomainPair } from "@/lib/search-defaults";

export type RefreshMode = "prices" | "availability";

export interface RefreshRequest {
  mode: RefreshMode;
  /** Undefined = every domain in the search. */
  pairs?: DomainPair[];
  /** Domains that will be charged (prices: available ones only). */
  count: number;
}

const COPY: Record<RefreshMode, { title: string; body: string; action: string }> = {
  prices: {
    title: "Refresh prices",
    body: "Re-reads today's prices for the available domains from our daily price list. Availability stays as last checked. Taken domains are free.",
    action: "Refresh prices",
  },
  availability: {
    title: "Re-check availability",
    body: "Asks the registrars again, live, whether each domain is still free, with fresh prices.",
    action: "Re-check now",
  },
};

/** Confirm a paid refresh, showing exactly what it costs. */
export function RefreshConfirm({
  request,
  onCancel,
  onConfirm,
}: {
  request: RefreshRequest | null;
  onCancel: () => void;
  onConfirm: (r: RefreshRequest) => void;
}) {
  const pricing = useDomainQStore((s) => s.pricing);
  const credits = useDomainQStore((s) => s.user?.credits);
  if (!request) return null;
  const copy = COPY[request.mode];
  const cost = pricing
    ? request.mode === "prices"
      ? estimatePriceRefresh(pricing, request.count)
      : estimateChecks(pricing, request.count)
    : null;
  const short = cost !== null && credits != null && credits < cost;

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm" data-testid="refresh-cost">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {request.count} domain{request.count === 1 ? "" : "s"}
            </span>
            <span className="font-mono font-semibold text-foreground">
              {cost === null ? "…" : `${formatCredits(cost)} credits`}
            </span>
          </div>
          {short && <p className="mt-1 text-xs text-destructive">You have {formatCredits(credits)} credits.</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={request.count === 0} onClick={() => onConfirm(request)}>
            {copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
