import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceTable } from "@/components/landing/price-table";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { TldCheck } from "@/components/landing/tld-check";
import {
  getCatalog,
  getTld,
  MIN_INDEXABLE_REGISTRARS,
  POPULAR_TLD_ORDER,
  usd,
  type PublicTldDetail,
} from "@/lib/public-api";
import { SITE_URL } from "@/lib/site";
import { TLD_NOTES } from "@/lib/tld-notes";

export const revalidate = 21600;
export const dynamicParams = true;

const TLD_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)?$/;

type Props = { params: Promise<{ tld: string }> };

/** Pre-render the most-compared extensions; the rest render on first visit. */
export async function generateStaticParams() {
  const catalog = await getCatalog();
  return (catalog?.tlds ?? [])
    .filter((t) => t.registrars >= MIN_INDEXABLE_REGISTRARS)
    .slice(0, 100)
    .map((t) => ({ tld: t.tld }));
}

async function load(raw: string): Promise<PublicTldDetail | null> {
  const tld = decodeURIComponent(raw).toLowerCase().replace(/^\./, "");
  if (!TLD_PATTERN.test(tld)) return null;
  const detail = await getTld(tld);
  return detail && detail.offers.length > 0 ? detail : null;
}

const monthYear = (iso: string | null) =>
  new Date(iso ?? Date.now()).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tld } = await params;
  const detail = await load(tld);
  if (!detail) return { title: "Extension not found", robots: { index: false } };
  const cheapest = Math.min(...detail.offers.map((o) => o.registerPrice));
  const n = detail.offers.length;
  const title = `Cheapest .${detail.tld} domain: compare ${n} registrar${n === 1 ? "" : "s"} (${monthYear(detail.updatedAt)})`;
  const description = `.${detail.tld} registration from ${usd(cheapest)}. Compare first-year, renewal and 3-year prices for .${detail.tld} across ${n} registrars, updated daily, then check if your name is free.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/tld/${detail.tld}` },
    openGraph: { title, description, url: `/tld/${detail.tld}` },
    robots: n >= MIN_INDEXABLE_REGISTRARS ? undefined : { index: false, follow: true },
  };
}

export default async function TldPage({ params }: Props) {
  const { tld: raw } = await params;
  const detail = await load(raw);
  if (!detail) notFound();

  const { tld, offers } = detail;
  const note = TLD_NOTES[tld];
  const best = offers[0];
  const firstYear = [...offers].sort((a, b) => a.registerPrice - b.registerPrice)[0];
  const renewal = [...offers].sort((a, b) => a.renewalPrice - b.renewalPrice)[0];
  const spread = offers[offers.length - 1].threeYearTotal - best.threeYearTotal;
  const trap = offers.filter((o) => o.renewalPrice > o.registerPrice * 1.5);
  const catalog = await getCatalog();
  const related = POPULAR_TLD_ORDER.filter((t) => t !== tld && catalog?.tlds.some((c) => c.tld === t)).slice(0, 12);
  const updated = detail.updatedAt
    ? new Date(detail.updatedAt).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "DQuery", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Prices by extension", item: `${SITE_URL}/tld` },
      { "@type": "ListItem", position: 3, name: `.${tld}`, item: `${SITE_URL}/tld/${tld}` },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/tld" className="hover:text-foreground">Prices by extension</Link>
          <span className="mx-2">/</span>
          <span className="font-mono text-foreground">.{tld}</span>
        </nav>

        <header className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Cheapest <span className="font-mono text-primary">.{tld}</span> domain registration
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {offers.length} registrar{offers.length === 1 ? "" : "s"} compared, sorted by what you&apos;ll actually pay over
            three years{note ? `. Best for ${note.bestFor}.` : "."}
            {updated && <span className="block pt-1 text-sm">Prices updated {updated}, in USD.</span>}
          </p>
        </header>

        <section aria-label="Check a name" className="mt-8 max-w-2xl">
          <TldCheck tld={tld} />
        </section>

        <dl className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Cheapest first year" value={usd(firstYear.registerPrice)} sub={firstYear.registrar} />
          <Stat label="Cheapest renewal" value={usd(renewal.renewalPrice)} sub={renewal.registrar} />
          <Stat label="Best 3-year total" value={usd(best.threeYearTotal)} sub={best.registrar} highlight />
          <Stat label="Shopping around saves" value={usd(spread)} sub="over 3 years, cheapest vs priciest" />
        </dl>

        <section className="mt-10" aria-labelledby="prices">
          <h2 id="prices" className="mb-4 text-xl font-semibold text-foreground">.{tld} prices by registrar</h2>
          <PriceTable offers={offers} caption={`.${tld} registration, renewal and 3-year prices by registrar`} />
          <p className="mt-3 text-xs text-muted-foreground">
            Standard prices excluding tax. Premium names cost more and are priced when you search. Prices in other currencies
            are converted to USD at the day&apos;s exchange rate.
          </p>
        </section>

        {trap.length > 0 && (
          <section className="mt-10 rounded-2xl border border-warning/40 bg-warning/[0.06] p-6">
            <h2 className="text-lg font-semibold text-foreground">Watch the renewal price</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {trap.length === 1 ? `${trap[0].registrar} charges` : `${trap.length} registrars charge`} far more to renew a
              .{tld} than to register it: for example {trap[0].registrar} at {usd(trap[0].registerPrice)} for the first year,
              then {usd(trap[0].renewalPrice)} a year. That&apos;s why this table is sorted by the 3-year total.
            </p>
          </section>
        )}

        {note && (
          <section className="mt-10 max-w-3xl" aria-labelledby="about">
            <h2 id="about" className="text-xl font-semibold text-foreground">About .{tld}</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">{note.note}</p>
            {note.restricted && (
              <p className="mt-3 leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Who can register: </span>
                {note.restricted}
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">Registry: {note.registry}</p>
          </section>
        )}

        <section className="mt-10 max-w-3xl" aria-labelledby="method">
          <h2 id="method" className="text-xl font-semibold text-foreground">How these prices are collected</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            DQuery reads each registrar&apos;s published price list or API every day and converts every price to US dollars.
            When you search, availability is checked live, and premium names get their own quote. We don&apos;t sell domains:
            you buy directly from the registrar you choose.
          </p>
        </section>

        {related.length > 0 && (
          <nav className="mt-12" aria-label="Other extensions">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Compare other extensions</h2>
            <ul className="flex flex-wrap gap-2">
              {related.map((t) => (
                <li key={t}>
                  <Link href={`/tld/${t}`} className="inline-flex rounded-lg border border-border px-3 py-1.5 font-mono text-sm text-muted-foreground hover:border-primary hover:text-primary">
                    .{t}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
      <SiteFooter tlds={catalog?.tlds.map((t) => t.tld)} />
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-primary/50 bg-primary/[0.06]" : "border-border bg-card"}`}>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-1 font-mono text-2xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</dd>
      <dd className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</dd>
    </div>
  );
}

