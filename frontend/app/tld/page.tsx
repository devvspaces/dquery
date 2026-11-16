import type { Metadata } from "next";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { TldIndex } from "@/components/landing/tld-index";
import { getCatalog } from "@/lib/public-api";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Domain prices by extension: compare registrars",
  description:
    "Registration, renewal and 3-year prices for hundreds of domain extensions, compared across registrars and updated daily.",
  alternates: { canonical: "/tld" },
};

export default async function TldIndexPage() {
  const catalog = await getCatalog();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Domain prices by extension</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          {catalog
            ? `${catalog.stats.tlds.toLocaleString()} extensions and ${catalog.stats.prices.toLocaleString()} prices from ${catalog.stats.registrars} registrars, in USD.`
            : "Registration and renewal prices compared across registrars."}{" "}
          Pick one to see every registrar side by side.
        </p>
        <div className="mt-8">
          {catalog ? (
            <TldIndex tlds={catalog.tlds} />
          ) : (
            <p className="text-muted-foreground">Prices are temporarily unavailable. Please try again shortly.</p>
          )}
        </div>
      </main>
      <SiteFooter tlds={catalog?.tlds.map((t) => t.tld)} />
    </div>
  );
}
