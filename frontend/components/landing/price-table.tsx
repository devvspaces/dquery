import { cn } from "@/lib/utils";
import { usd, type PublicOffer } from "@/lib/public-api";

/**
 * Registrar prices for one extension, cheapest 3-year total first. Only the
 * best row is highlighted (Von Restorff), and long lists are cut to `limit`
 * rows plus "+N more" (Miller).
 */
export function PriceTable({
  offers,
  limit,
  caption,
  className,
}: {
  offers: PublicOffer[];
  limit?: number;
  caption?: string;
  className?: string;
}) {
  const rows = limit ? offers.slice(0, limit) : offers;
  const hidden = offers.length - rows.length;
  const best = offers[0];

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 font-medium">Registrar</th>
            <th scope="col" className="px-2 py-2.5 text-right font-medium">1st year</th>
            <th scope="col" className="px-2 py-2.5 text-right font-medium">Renewal</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">3 years</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const isBest = o === best;
            return (
              <tr
                key={o.registrarId}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  isBest && "bg-primary/[0.07]"
                )}
              >
                <th scope="row" className="px-4 py-2.5 font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    {o.registrar}
                    {isBest && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Best 3-yr
                      </span>
                    )}
                  </span>
                </th>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums text-foreground">
                  {usd(o.registerPrice)}
                  {o.isPromo && <span className="ml-1 text-[10px] text-warning" title="Promotional first-year price">promo</span>}
                </td>
                <td
                  className={cn(
                    "px-2 py-2.5 text-right font-mono tabular-nums",
                    o.renewalPrice > o.registerPrice * 1.5 ? "text-warning" : "text-muted-foreground"
                  )}
                >
                  {usd(o.renewalPrice)}
                </td>
                <td className={cn("px-4 py-2.5 text-right font-mono font-semibold tabular-nums", isBest ? "text-primary" : "text-foreground")}>
                  {usd(o.threeYearTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hidden > 0 && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">+{hidden} more registrar{hidden === 1 ? "" : "s"}</p>
      )}
    </div>
  );
}
