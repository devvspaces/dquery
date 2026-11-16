import type { Metadata } from "next";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export const metadata: Metadata = {
  title: "Credits and affiliate disclosure",
  description: "How DQuery is funded, where its prices and word data come from, and the sources it credits.",
  alternates: { canonical: "/legal/credits" },
};

const SOURCES: Array<[string, string, string]> = [
  ["Exchange rates", "Rates By Exchange Rate API", "https://www.exchangerate-api.com"],
  ["Pronunciations", "CMU Pronouncing Dictionary, © Carnegie Mellon University (BSD-2-Clause)", "https://github.com/cmusphinx/cmudict"],
  ["Word frequencies", "FrequencyWords by Hermit Dave (OpenSubtitles), CC BY-SA 4.0", "https://github.com/hermitdave/FrequencyWords"],
  ["Word meanings", "WordNet (Princeton University)", "https://wordnet.princeton.edu"],
  ["Blocked words", "List of Dirty, Naughty, Obscene, and Otherwise Bad Words (LDNOOBW), CC BY 4.0", "https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words"],
];

export default function CreditsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Credits and disclosure</h1>

        <section className="mt-8 space-y-3 text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Affiliate disclosure</h2>
          <p>
            DQuery doesn&apos;t sell domains. When you click Buy, you go to the registrar and buy from them directly. Some of
            those links are affiliate links: if you buy, the registrar may pay us a commission. It costs you nothing extra.
          </p>
          <p>
            Commissions never change how results are ranked. Offers are always sorted by price, and registrars without an
            affiliate program are shown exactly the same way.
          </p>
        </section>

        <section className="mt-10 space-y-3 text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Prices</h2>
          <p>
            Prices come from each registrar&apos;s published price list or API, refresh daily, and are shown excluding tax.
            Availability is checked live when you search. Always confirm the final price at the registrar before paying.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-foreground">Data sources</h2>
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
            {SOURCES.map(([what, name, url]) => (
              <li key={what} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
                <span className="text-sm text-muted-foreground">{what}</span>
                <a href={url} target="_blank" rel="noopener" className="text-sm text-foreground hover:text-primary">
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
