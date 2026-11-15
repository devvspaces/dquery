import { cn } from "@/lib/utils";
import type { RegistrarPrice } from "@/lib/types";

/** "$9.37", with the registrar's own price in a tooltip when it was converted. */
export function PriceText({
  amount,
  offer,
  className,
}: {
  amount: number | null;
  offer?: Pick<RegistrarPrice, "originalCurrency" | "originalPrice">;
  className?: string;
}) {
  if (amount === null) return <span className="text-muted-foreground">--</span>;
  const converted = !!offer?.originalCurrency && offer.originalPrice != null;
  const original = converted
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: offer!.originalCurrency!,
        maximumFractionDigits: 2,
      }).format(offer!.originalPrice!)
    : null;
  return (
    <span
      className={className}
      title={original ? `Charged as ${original}; converted at today's rate` : undefined}
    >
      ${amount.toFixed(2)}
      {original && <span className="ml-0.5 align-super text-[9px] text-muted-foreground">≈</span>}
    </span>
  );
}

/** Outbound "Buy" link to the registrar's search/checkout page. */
export function BuyLink({ offer, className }: { offer: RegistrarPrice; className?: string }) {
  if (!offer.purchaseUrl || !offer.available) return null;
  return (
    <a
      href={offer.purchaseUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground hover:border-primary hover:text-primary",
        className
      )}
      aria-label={`Buy at ${offer.registrar}`}
    >
      Buy
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7M7 7h10v10" />
      </svg>
    </a>
  );
}

/** Yes / No / Unknown: a failed check must never read as "taken". */
export function AvailabilityPill({ offer }: { offer: RegistrarPrice }) {
  const unknown = !offer.available && offer.status === "unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        offer.available
          ? "bg-success/10 text-success"
          : unknown
            ? "bg-muted text-muted-foreground"
            : "bg-destructive/10 text-destructive"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          offer.available ? "bg-success" : unknown ? "bg-muted-foreground" : "bg-destructive"
        )}
      />
      {offer.available ? "Yes" : unknown ? "Unknown" : "No"}
    </span>
  );
}
