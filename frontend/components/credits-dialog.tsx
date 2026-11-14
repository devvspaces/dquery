"use client";

import { useState } from "react";
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

const creditPacks = [
  { credits: 10, price: 1, label: "Starter", popular: false },
  { credits: 50, price: 5, label: "Standard", popular: true },
  { credits: 120, price: 10, label: "Pro", popular: false },
  { credits: 300, price: 20, label: "Power", popular: false },
];

type PaymentMethod = "stripe" | "usdc";

export function CreditsDialog({ open, onOpenChange }: CreditsDialogProps) {
  const { user } = useDomainQStore();
  const [selectedPack, setSelectedPack] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePurchase = async () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      alert("Payment system integration is in progress. For local testing, please add credits to your account using the backend CLI command.");
    }, 1000);
  };

  const pack = creditPacks[selectedPack];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden gap-0">
        {/* Success overlay */}
        {success && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm animate-fade-in">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-foreground">Payment successful</p>
            <p className="text-sm text-muted-foreground mt-1">{pack.credits} credits added to your account</p>
          </div>
        )}

        {/* Header with balance */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Buy credits
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Each search costs 1 credit. Choose a pack and payment method.
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
              <span className="text-sm font-semibold text-foreground">{user.credits?.toFixed(1) ?? "0.0"} credits</span>
            </div>
          )}
        </div>

        {/* Credit packs */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {creditPacks.map((p, i) => (
              <button
                key={p.label}
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
                  <span className="text-lg font-semibold text-foreground">${p.price}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  ${(p.price / p.credits).toFixed(2)}/credit
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Payment method */}
        <div className="px-6 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
            Payment method
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPaymentMethod("stripe")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2.5 rounded-lg border-2 px-4 py-3 transition-all",
                paymentMethod === "stripe"
                  ? "border-primary bg-primary/[0.04]"
                  : "border-border hover:border-muted-foreground/30 bg-card"
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
              <span className="text-sm font-medium text-foreground">Card</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="ml-auto">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-7.076-2.19l-.891 5.527C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" fill="#6772E5" />
              </svg>
            </button>
            <button
              onClick={() => setPaymentMethod("usdc")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2.5 rounded-lg border-2 px-4 py-3 transition-all",
                paymentMethod === "usdc"
                  ? "border-primary bg-primary/[0.04]"
                  : "border-border hover:border-muted-foreground/30 bg-card"
              )}
            >
              <svg width="16" height="16" viewBox="0 0 32 32" className="text-foreground">
                <circle cx="16" cy="16" r="16" fill="#2775CA" />
                <path d="M20.4 18c0-2.2-1.3-3-4-3.4-1.9-.3-2.3-.9-2.3-1.8s.6-1.5 1.9-1.5c1.1 0 1.7.4 2 1.3a.4.4 0 0 0 .4.3h1a.4.4 0 0 0 .4-.5A3.4 3.4 0 0 0 16.7 10v-1.5a.4.4 0 0 0-.4-.4h-.9a.4.4 0 0 0-.4.4V10a3.1 3.1 0 0 0-2.8 3.2c0 2.1 1.3 2.9 4 3.3 1.7.3 2.3.8 2.3 1.9s-1 1.7-2.2 1.7-2.2-.7-2.4-1.6a.4.4 0 0 0-.4-.3h-1a.4.4 0 0 0-.4.4 3.4 3.4 0 0 0 3 3v1.5c0 .2.2.4.4.4h.9c.2 0 .4-.2.4-.4V22a3.3 3.3 0 0 0 3-3.3z" fill="#fff" />
              </svg>
              <span className="text-sm font-medium text-foreground">USDC</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="ml-auto">
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" fill="#0052FF" />
                <path d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" fill="#0052FF" />
              </svg>
            </button>
          </div>
        </div>

        {/* Purchase button */}
        <div className="border-t border-border bg-muted/30 px-6 py-4">
          <button
            onClick={handlePurchase}
            disabled={processing}
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
                <span>Processing payment...</span>
              </div>
            ) : (
              <>
                Pay ${pack.price} for {pack.credits} credits
                {paymentMethod === "usdc" && (
                  <span className="text-xs opacity-70">via Coinbase</span>
                )}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
