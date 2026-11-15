"use client";

import { formatCredits } from "@/lib/pricing";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDomainQStore } from "@/lib/store/use-domainq-store";

interface CreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreditPack {
  id: string;
  label: string;
  credits: number;
  price: number;
  currency: string;
  popular: boolean;
}

/** "$5" / "₦8,000" */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function CreditsDialog({ open, onOpenChange }: CreditsDialogProps) {
  const { user, token } = useDomainQStore();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [selectedPack, setSelectedPack] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || packs.length) return;
    fetch(`${API_BASE_URL}/api/credits/packs`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: CreditPack[]) => {
        setPacks(list);
        const popular = list.findIndex((p) => p.popular);
        setSelectedPack(popular >= 0 ? popular : 0);
      })
      .catch(() => setError("Couldn't load credit packs."));
  }, [open, packs.length]);

  const handlePurchase = async () => {
    const chosen = packs[selectedPack];
    if (!chosen || !token) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packId: chosen.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Couldn't start checkout");
      window.location.href = body.url; // Paystack hosted checkout
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout");
      setProcessing(false);
    }
  };

  const pack = packs[selectedPack];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden gap-0">
        {/* Header with balance */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Buy credits
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              AI generation costs 1 credit per run, and each name × extension checked costs 0.05
              (with the full registrar price comparison). A typical search of 15 names across 3
              extensions is 3.25 credits.
            </DialogDescription>
          </DialogHeader>
          {user && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12" />
                <path d="M15.5 9.4a4 4 0 0 0-7 0" />
                <path d="M8.5 14.6a4 4 0 0 0 7 0" />
              </svg>
              <span className="text-sm text-muted-foreground">Current balance:</span>
              <span className="text-sm font-semibold text-foreground">{formatCredits(user.credits)} credits</span>
            </div>
          )}
        </div>

        {/* Credit packs */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {packs.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setSelectedPack(i)}
                className={cn(
                  "relative flex flex-col items-center rounded-xl border-2 px-3 py-4 transition-all",
                  selectedPack === i
                    ? "border-primary bg-primary/[0.04]"
                    : "border-border hover:border-muted-foreground/30 bg-card"
                )}
              >
                {p.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase tracking-wider">
                    Popular
                  </span>
                )}
                <span className="text-2xl font-bold text-foreground tracking-tight">{p.credits}</span>
                <span className="text-xs text-muted-foreground mt-0.5">credits</span>
                <div className="mt-2 flex items-baseline gap-0.5">
                  <span className="text-lg font-semibold text-foreground">{formatMoney(p.price, p.currency)}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatMoney(p.price / p.credits, p.currency)}/credit
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Card payments are processed securely by Paystack. Credits never expire.
          </p>
        </div>

        {error && (
          <p className="px-6 pb-3 text-center text-xs text-destructive">{error}</p>
        )}

        {/* Purchase button */}
        <div className="border-t border-border bg-muted/30 px-6 py-4">
          <button
            onClick={handlePurchase}
            disabled={processing || !pack}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {processing ? (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse_dot" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse_dot" style={{ animationDelay: "0.2s" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse_dot" style={{ animationDelay: "0.4s" }} />
                </div>
                <span>Opening secure checkout...</span>
              </div>
            ) : (
              <>{pack ? `Pay ${formatMoney(pack.price, pack.currency)} for ${pack.credits} credits` : "Loading packs..."}</>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
