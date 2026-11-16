/**
 * Short, hand-written context for the most-searched extensions, shown on
 * their price pages. Keep it factual: who runs it, who can register, and
 * anything a buyer should know before paying.
 */
export interface TldNote {
  /** Who it's for, in a few words (used in titles and intros). */
  bestFor: string;
  /** Registry operator. */
  registry: string;
  /** One or two sentences a buyer should know. */
  note: string;
  /** Registration restricted to certain people or organisations. */
  restricted?: string;
}

export const TLD_NOTES: Record<string, TldNote> = {
  com: {
    bestFor: "any business",
    registry: "Verisign",
    note: "The most recognised extension worldwide and the one people type by default. Short .com names are scarce, so expect to get creative or add a word.",
  },
  net: {
    bestFor: "tech and network services",
    registry: "Verisign",
    note: "Originally for network providers, now open to anyone. A common fallback when the .com is taken.",
  },
  org: {
    bestFor: "non-profits and communities",
    registry: "Public Interest Registry",
    note: "Associated with non-profits and open-source projects, but anyone can register one.",
  },
  io: {
    bestFor: "tech startups and developer tools",
    registry: "Identity Digital",
    note: "Technically the country code of the British Indian Ocean Territory, but widely used by tech companies. Renewals are usually much higher than promotional first-year prices, so compare the 3-year total.",
  },
  ai: {
    bestFor: "AI products and startups",
    registry: "Government of Anguilla",
    note: "Anguilla's country code, now one of the most in-demand extensions thanks to AI companies. It is among the more expensive popular extensions, and prices vary widely between registrars.",
  },
  co: {
    bestFor: "companies and startups",
    registry: "Registry .co (GoDaddy Registry)",
    note: "Colombia's country code, marketed worldwide as short for company. A popular alternative when the .com is taken.",
  },
  app: {
    bestFor: "apps and web products",
    registry: "Google Registry",
    note: "Every .app site must use HTTPS: browsers enforce it, so you need an SSL certificate (most hosts provide one free).",
  },
  dev: {
    bestFor: "developers and dev tools",
    registry: "Google Registry",
    note: "Like .app, .dev requires HTTPS in every major browser. Popular for developer portfolios, docs and tools.",
  },
  xyz: {
    bestFor: "cheap, flexible names",
    registry: "XYZ.com",
    note: "Often very cheap for the first year. Check the renewal price before you commit: it is usually several times higher.",
  },
  me: {
    bestFor: "personal sites and brands",
    registry: "doMEn (Montenegro)",
    note: "Montenegro's country code, widely used for personal pages, resumes and link-in-bio sites.",
  },
  tech: {
    bestFor: "technology companies",
    registry: "Radix",
    note: "A descriptive extension for tech brands. First-year promotions are common; renewals cost more.",
  },
  online: {
    bestFor: "online businesses",
    registry: "Radix",
    note: "A generic extension with frequent first-year discounts. Compare renewals carefully.",
  },
  store: {
    bestFor: "online shops",
    registry: "Radix",
    note: "Signals e-commerce at a glance. Promotional first years are common, with much higher renewals.",
  },
  shop: {
    bestFor: "online shops",
    registry: "GMO Registry",
    note: "A short, clear extension for stores. Prices differ a lot between registrars.",
  },
  site: {
    bestFor: "general websites",
    registry: "Radix",
    note: "A cheap, generic extension. Look at the 3-year total, not just the first year.",
  },
  info: {
    bestFor: "information and resource sites",
    registry: "Identity Digital",
    note: "One of the original generic extensions, open to anyone.",
  },
  us: {
    bestFor: "US businesses and residents",
    registry: "GoDaddy Registry",
    note: "Short and recognisable for American audiences.",
    restricted: "Registrants must be US citizens or residents, or organisations with a bona fide presence in the United States.",
  },
  uk: {
    bestFor: "UK businesses and people",
    registry: "Nominet",
    note: "The shorter alternative to .co.uk, open to anyone.",
  },
  "co.uk": {
    bestFor: "UK businesses",
    registry: "Nominet",
    note: "The best-known UK extension and a strong trust signal for British customers. Open to anyone.",
  },
  ng: {
    bestFor: "Nigerian businesses and brands",
    registry: "NiRA (Nigeria Internet Registration Association)",
    note: "Nigeria's country code. A strong local signal for customers in Nigeria; often priced in naira by local registrars.",
  },
  "com.ng": {
    bestFor: "Nigerian companies",
    registry: "NiRA (Nigeria Internet Registration Association)",
    note: "The most common Nigerian business extension, usually much cheaper than .ng.",
  },
  africa: {
    bestFor: "pan-African brands",
    registry: "ZA Central Registry",
    note: "A continent-wide extension for brands operating across Africa.",
  },
  ke: {
    bestFor: "Kenyan businesses",
    registry: "KeNIC",
    note: "Kenya's country code, popular with Kenyan brands and startups.",
  },
  "co.ke": {
    bestFor: "Kenyan companies",
    registry: "KeNIC",
    note: "The standard extension for companies in Kenya.",
  },
  "co.za": {
    bestFor: "South African businesses",
    registry: "ZA Central Registry",
    note: "South Africa's best-known extension and a strong local trust signal.",
  },
};
