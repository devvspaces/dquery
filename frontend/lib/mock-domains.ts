import type { DomainResult, RegistrarPrice } from "@/lib/types";

const REGISTRARS = ["Namecheap", "GoDaddy", "Google Domains", "Cloudflare", "Porkbun"];

const BASE_PRICES: Record<string, { register: number; renewal: number }> = {
  ".com": { register: 9.99, renewal: 14.99 },
  ".net": { register: 11.99, renewal: 15.99 },
  ".org": { register: 10.99, renewal: 14.99 },
  ".io": { register: 32.99, renewal: 44.99 },
  ".co": { register: 11.99, renewal: 29.99 },
  ".dev": { register: 12.99, renewal: 15.99 },
  ".app": { register: 14.99, renewal: 17.99 },
  ".ai": { register: 49.99, renewal: 79.99 },
  ".tech": { register: 4.99, renewal: 39.99 },
  ".xyz": { register: 1.99, renewal: 12.99 },
  ".me": { register: 8.99, renewal: 19.99 },
  ".info": { register: 3.99, renewal: 22.99 },
  ".biz": { register: 9.99, renewal: 19.99 },
  ".store": { register: 1.99, renewal: 29.99 },
  ".online": { register: 1.99, renewal: 34.99 },
  ".site": { register: 2.99, renewal: 29.99 },
  ".cloud": { register: 7.99, renewal: 21.99 },
  ".design": { register: 29.99, renewal: 39.99 },
  ".agency": { register: 19.99, renewal: 29.99 },
  ".studio": { register: 19.99, renewal: 29.99 },
};

function generatePriceVariation(base: number): number {
  const variation = (Math.random() - 0.5) * base * 0.4;
  return Math.max(0.99, Number((base + variation).toFixed(2)));
}

function generateRegistrarPrices(
  extension: string,
  isAvailable: boolean
): RegistrarPrice[] {
  const base = BASE_PRICES[extension] || { register: 12.99, renewal: 19.99 };

  return REGISTRARS.map((registrar) => {
    const available = isAvailable ? Math.random() > 0.15 : false;
    return {
      registrar,
      available,
      registerPrice: available ? generatePriceVariation(base.register) : null,
      renewalPrice: available ? generatePriceVariation(base.renewal) : null,
    };
  });
}

const NAME_PATTERNS = [
  (name: string) => name.toLowerCase().replace(/\s+/g, ""),
  (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
  (name: string) => `get${name.replace(/\s+/g, "").toLowerCase()}`,
  (name: string) => `${name.replace(/\s+/g, "").toLowerCase()}hq`,
  (name: string) => `try${name.replace(/\s+/g, "").toLowerCase()}`,
  (name: string) => `${name.replace(/\s+/g, "").toLowerCase()}app`,
  (name: string) => `use${name.replace(/\s+/g, "").toLowerCase()}`,
  (name: string) => `${name.split(" ")[0]?.toLowerCase() ?? ""}hub`,
  (name: string) => {
    const words = name.toLowerCase().split(/\s+/);
    return words.map((w) => w[0]).join("");
  },
  (name: string) => `${name.replace(/\s+/g, "").toLowerCase()}ly`,
  (name: string) => `the${name.replace(/\s+/g, "").toLowerCase()}`,
  (name: string) => `${name.replace(/\s+/g, "").toLowerCase()}hub`,
  (name: string) => `${name.replace(/\s+/g, "").toLowerCase()}pro`,
  (name: string) => `go${name.replace(/\s+/g, "").toLowerCase()}`,
  (name: string) => `my${name.replace(/\s+/g, "").toLowerCase()}`,
];

export function generateMockDomains(
  businessName: string,
  _description: string,
  tlds: string[]
): DomainResult[] {
  const names = NAME_PATTERNS.map((fn) => fn(businessName)).filter(
    (n) => n.length >= 2
  );
  const uniqueNames = [...new Set(names)];

  const results: DomainResult[] = [];

  for (const name of uniqueNames) {
    for (const tld of tlds) {
      const domain = `${name}${tld}`;
      const available = Math.random() > 0.35;
      const prices = generateRegistrarPrices(tld, available);
      const availablePrices = prices
        .filter((p) => p.registerPrice !== null)
        .map((p) => p.registerPrice as number);

      results.push({
        domain,
        name,
        extension: tld,
        available,
        prices,
        bestPrice: availablePrices.length > 0 ? Math.min(...availablePrices) : null,
      });
    }
  }

  return results;
}

export function checkMockDomain(domain: string): DomainResult[] {
  const hasDot = domain.includes(".");

  if (hasDot) {
    const lastDotIndex = domain.lastIndexOf(".");
    const name = domain.substring(0, lastDotIndex);
    const extension = domain.substring(lastDotIndex);
    const available = Math.random() > 0.4;
    const prices = generateRegistrarPrices(extension, available);
    const availablePrices = prices
      .filter((p) => p.registerPrice !== null)
      .map((p) => p.registerPrice as number);

    return [
      {
        domain,
        name,
        extension,
        available,
        prices,
        bestPrice: availablePrices.length > 0 ? Math.min(...availablePrices) : null,
      },
    ];
  }

  const popularTlds = [".com", ".net", ".org", ".io", ".co", ".dev", ".ai", ".app"];

  return popularTlds.map((tld) => {
    const fullDomain = `${domain}${tld}`;
    const available = Math.random() > 0.4;
    const prices = generateRegistrarPrices(tld, available);
    const availablePrices = prices
      .filter((p) => p.registerPrice !== null)
      .map((p) => p.registerPrice as number);

    return {
      domain: fullDomain,
      name: domain,
      extension: tld,
      available,
      prices,
      bestPrice: availablePrices.length > 0 ? Math.min(...availablePrices) : null,
    };
  });
}
