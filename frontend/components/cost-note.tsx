"use client";

import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { formatCredits, type CreditPricing } from "@/lib/pricing";

interface CostNoteProps {
  /** Computes the cost from the current prices; null hides the note. */
  cost: (pricing: CreditPricing) => number | null;
  detail?: string;
}

/** "Costs 3.25 credits · 15 names × 3 TLDs" under a submit button. */
export function CostNote({ cost, detail }: CostNoteProps) {
  const pricing = useDomainQStore((s) => s.pricing);
  const user = useDomainQStore((s) => s.user);
  if (!pricing) return null;
  const value = cost(pricing);
  if (value == null) return null;
  const short = user?.credits != null && user.credits < value;

  return (
    <p className="text-center text-xs text-muted-foreground" data-testid="cost-note">
      Costs <span className="font-medium text-foreground">{formatCredits(value)} credits</span>
      {detail && <> · {detail}</>}
      {short && <span className="text-destructive"> · you have {formatCredits(user?.credits)}</span>}
    </p>
  );
}
