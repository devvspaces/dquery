import type { Metadata } from "next";
import Link from "next/link";
import { HeroSearch } from "@/components/landing/hero-search";
import { PriceTable } from "@/components/landing/price-table";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import {
  getCatalog,
  getPacks,
  getPricing,
  getPromo,
  getTld,
  renewalTrapCandidates,
  renewalStory,
  usd,
} from "@/lib/public-api";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "DQuery: domain name generator and registrar price comparison" },
  description:
    "Generate brandable domain names with AI or a word builder, check availability live, and compare first-year, renewal and 3-year prices across registrars before you buy.",
  alternates: { canonical: "/" },
};

const REGISTRARS = ["Namecheap", "Porkbun", "Spaceship", "Cloudflare", "OVHcloud", "Truehost", "WhoGoHost"];



export default async function Home() {
  const [catalog, pricing, promo, packs] = await Promise.all([getCatalog(), getPricing(), getPromo(), getPacks()]);
  // Show a real renewal trap: the first well-compared TLD where a cheaper
  // first year costs more over 3 years. Falls back to the biggest spread.
  const candidates = renewalTrapCandidates(catalog).slice(0, 6);
  const details = (await Promise.all(candidates.map((c) => getTld(c.tld)))).filter((d) => d && d.offers.length > 1);
  const demo =
    details.find((d) => renewalStory(d!.offers)?.isTrap) ?? details[0] ?? (await getTld("io"));
  const demoTld = demo?.tld ?? "io";
  const offers = demo?.offers ?? [];
  const story = renewalStory(offers);

  const freeCredits = promo ? (promo.earlyRemaining > 0 ? promo.earlyAmount : promo.defaultAmount) : 10;
  const registrarCount = catalog?.stats.registrars || 6;
  const priceCount = catalog?.stats.prices ?? 3000;
  const tldCount = catalog?.stats.tlds ?? 500;
  const perCheck = pricing?.perDomainCheck ?? 0.05;
  const microcopy = `${freeCredits} free credits · no card · sign in with GitHub`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "DQuery",
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: metadata.description,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: `${freeCredits} free credits on sign-up` },
      },
      { "@type": "Organization", name: "DQuery", url: SITE_URL, logo: `${SITE_URL}/icon.svg` },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />

      <main>
        {/* Hero: value proposition + the product's own input (product as hero) */}
        <section className="hero-glow relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 md:pt-20 lg:grid-cols-[1.1fr_1fr]">
            <div className="text-center motion-safe:animate-fade-in lg:text-left">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                {priceCount.toLocaleString()} live prices from {registrarCount} registrars
              </p>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Find a name. Then find who sells it <span className="text-primary">cheapest.</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground lg:mx-0">
                Generate brandable names with AI or our word builder, check them live, and compare first-year,
                renewal and 3-year prices across registrars before you buy.
              </p>
              <div className="mx-auto mt-8 max-w-xl lg:mx-0">
                <HeroSearch />
                <p className="mt-3 text-xs text-muted-foreground">{microcopy}</p>
              </div>
            </div>

            {offers.length > 0 && (
              <div className="motion-safe:animate-fade-in [animation-delay:150ms]">
                <div className="mb-3 flex items-baseline justify-between px-1">
                  <p className="font-mono text-sm text-foreground">
                    yourname<span className="text-primary">.{demoTld}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Today&apos;s prices, sorted by 3-year cost</p>
                </div>
                <PriceTable offers={offers} limit={5} caption={`.${demoTld} registration prices by registrar`} />
              </div>
            )}
          </div>
        </section>

        {/* Proof strip */}
        <section aria-label="Registrars compared" className="border-y border-border bg-card/40">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 text-sm text-muted-foreground">
            <span className="text-xs uppercase tracking-wider">Prices compared from</span>
            {REGISTRARS.map((r) => (
              <span key={r} className="font-semibold text-foreground/70">{r}</span>
            ))}
            <span className="text-xs">and more · {tldCount.toLocaleString()} extensions</span>
          </div>
        </section>

        {/* Renewal trap (problem → agitate → solve), with real numbers */}
        {story && (
          <section className="mx-auto max-w-6xl px-4 py-20">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-primary">The renewal trap</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  The cheap first year is the bait.
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Registrars win you with a low first-year price and make it back on renewals, every year you keep the
                  name. DQuery shows the renewal and the 3-year total up front, so the cheapest deal is actually cheapest.
                </p>
                <Link href={`/tld/${demoTld}`} className="mt-6 inline-flex text-sm font-medium text-primary hover:underline">
                  See every .{demoTld} price →
                </Link>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {story.isTrap ? "Cheapest first year" : "Another registrar"}
                  </p>
                  <p className="mt-1 text-foreground">
                    <span className="font-semibold">{story.bait.registrar}</span>{" "}
                    <span className="font-mono">{usd(story.bait.registerPrice)}</span> first year, then{" "}
                    <span className="font-mono text-warning">{usd(story.bait.renewalPrice)}</span>/yr
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold text-foreground">{usd(story.bait.threeYearTotal)} <span className="text-sm font-normal text-muted-foreground">over 3 years</span></p>
                </div>
                <div className="rounded-2xl border border-primary/40 bg-primary/[0.06] p-5">
                  <p className="text-xs uppercase tracking-wider text-primary">Cheapest over 3 years</p>
                  <p className="mt-1 text-foreground">
                    <span className="font-semibold">{story.best.registrar}</span>{" "}
                    <span className="font-mono">{usd(story.best.registerPrice)}</span> first year, then{" "}
                    <span className="font-mono">{usd(story.best.renewalPrice)}</span>/yr
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold text-primary">{usd(story.best.threeYearTotal)} <span className="text-sm font-normal text-muted-foreground">over 3 years</span></p>
                </div>
                <p className="text-center text-sm font-medium text-foreground">
                  You keep <span className="font-mono text-primary">{usd(story.saving)}</span> on one .{demoTld} domain.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* How it works: three steps (goal-gradient) */}
        <section id="how" className="scroll-mt-20 border-t border-border bg-card/30">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">From idea to domain in three steps</h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                ["Describe or build", "Tell the AI about your business, or build names from your own words: blends, compounds, rhymes and syllable patterns."],
                ["Keep the ones you like", "Review the list, drop what doesn't fit, add your own ideas. You only pay to check the names you keep."],
                ["Compare and buy", "See who has it, with first-year, renewal and 3-year cost side by side. Click Buy at the best deal."],
              ].map(([title, body], i) => (
                <li key={title} className="rounded-2xl border border-border bg-card p-6">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-bold text-primary">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features (bento) */}
        <section className="mx-auto max-w-6xl px-4 py-20" aria-labelledby="features">
          <h2 id="features" className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Built to save you money, not sell you one</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Feature className="md:col-span-2" title="Word builder: names without AI" body="Blend, compound, clip, rhyme or coin names from your own words and syllable patterns, scored for how easy they are to say and remember. A quarter of the price of an AI batch." />
            <Feature title="AI name generator" body="Twenty brandable names from a one-line description of your business." />
            <Feature title="Renewal-proof prices" body="First year, renewal and 3-year total for every registrar. No surprise in year two." />
            <Feature title="Live availability" body="Every name is checked with the registrars in real time, with results streamed in as they arrive." />
            <Feature title="One currency" body={`Naira, euro and pound prices converted to USD, across ${tldCount.toLocaleString()} extensions, so you compare like for like.`} />
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t border-border bg-card/30">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Pay for what you use</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                No subscription. Start with {freeCredits} free credits, then top up when you need more.
              </p>
            </div>
            <dl className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
              <Cost label="AI batch of 20 names" value={pricing?.perAiGeneration ?? 1} />
              <Cost label="Word builder batch" value={pricing?.perWordGeneration ?? 0.25} />
              <Cost label="Check one domain" value={perCheck} />
            </dl>
            {packs && packs.length > 0 && (
              <ul className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {packs.map((p) => (
                  <li
                    key={p.id}
                    className={`relative rounded-2xl border p-5 ${p.popular ? "border-primary/60 bg-primary/[0.06]" : "border-border bg-card"}`}
                  >
                    {p.popular && (
                      <span className="absolute -top-2.5 left-5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                        Most popular
                      </span>
                    )}
                    <p className="text-sm font-medium text-muted-foreground">{p.label}</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">${p.price}</p>
                    <p className="mt-1 text-sm text-foreground">{p.credits} credits</p>
                    <p className="mt-1 text-xs text-muted-foreground">≈ {Math.floor(p.credits / perCheck).toLocaleString()} domain checks</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-10 text-center">
              <Link href="/search" className="inline-flex h-11 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90">
                Start with {freeCredits} free credits
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ: objections, answered */}
        <section className="mx-auto max-w-3xl px-4 py-20" aria-labelledby="faq">
          <h2 id="faq" className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Questions</h2>
          <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
            {[
              ["Are the prices real?", "Yes. They come from each registrar's own price list or API and refresh daily, and availability is checked live when you search. Prices in other currencies are converted to USD at today's rate."],
              ["Do you sell domains?", "No. We find and compare; you buy directly from the registrar you pick. Some Buy links are affiliate links, which may earn us a commission at no extra cost to you."],
              ["Do I need AI?", "No. The word builder makes names from your own words with linguistic rules instead of AI, and costs a quarter as much."],
              ["What does a credit get me?", `One credit generates 20 AI names, or checks ${Math.round(1 / perCheck)} domains. Packs start at $1.`],
              ["Why does the renewal price matter?", "You pay it every year you keep the domain. A $1 first year with a $40 renewal costs more over three years than a steady $15."],
              ["Is it free to try?", `New accounts get ${freeCredits} free credits. No card needed.`],
            ].map(([q, a]) => (
              <details key={q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
                  {q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA (end on a high) */}
        <section className="hero-glow border-t border-border">
          <div className="mx-auto max-w-2xl px-4 py-20 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Your next name is 30 seconds away.</h2>
            <p className="mt-4 text-muted-foreground">Describe your idea or type the name you have in mind.</p>
            <div className="mt-8 text-left">
              <HeroSearch id="final" compact />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{microcopy}</p>
          </div>
        </section>
      </main>

      <SiteFooter tlds={catalog?.tlds.map((t) => t.tld)} />
    </div>
  );
}

function Feature({ title, body, className }: { title: string; body: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-6 ${className ?? ""}`}>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Cost({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold text-foreground">
        {value} credit{value === 1 ? "" : "s"}
      </dd>
    </div>
  );
}
