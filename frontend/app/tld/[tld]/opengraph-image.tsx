import { ogCard, OG_SIZE } from "@/lib/og";
import { getTld, usd } from "@/lib/public-api";

export const alt = "Domain extension price comparison";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 21600;

export default async function Image({ params }: { params: Promise<{ tld: string }> }) {
  const { tld: raw } = await params;
  const tld = decodeURIComponent(raw).toLowerCase().replace(/^\./, "").slice(0, 40);
  const detail = await getTld(tld);
  const offers = detail?.offers ?? [];
  const cheapest = offers.length ? Math.min(...offers.map((o) => o.registerPrice)) : null;
  return ogCard({
    title: `Cheapest .${tld} domain`,
    subtitle: offers.length
      ? `First-year, renewal and 3-year prices from ${offers.length} registrars, updated daily.`
      : "First-year, renewal and 3-year prices compared across registrars.",
    badge: cheapest !== null ? `from ${usd(cheapest)}` : undefined,
  });
}
