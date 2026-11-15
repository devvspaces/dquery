import { describe, expect, it } from "vitest";
import { mapBackendToFrontend, type BackendCheckItem } from "./map-results";

const item = (overrides: Partial<BackendCheckItem> = {}): BackendCheckItem => ({
  domain: "acme",
  tld: "com",
  bestPrice: 8.98,
  results: [
    {
      registrar: "Spaceship",
      available: true,
      status: "available",
      price: 8.98,
      renewalPrice: 9.98,
      threeYearTotal: 28.94,
      isPromo: true,
      premiumDomain: false,
    },
    {
      registrar: "Namecheap",
      available: true,
      status: "available",
      price: 11.28,
      renewalPrice: 18.48,
      threeYearTotal: 48.24,
      isPromo: false,
    },
  ],
  ...overrides,
});

describe("mapBackendToFrontend", () => {
  it("creates a placeholder row per name × TLD, in order, before results arrive", () => {
    const rows = mapBackendToFrontend([], ["acme", "zeta"], ["com", ".io"]);
    expect(rows.map((r) => r.domain)).toEqual(["acme.com", "acme.io", "zeta.com", "zeta.io"]);
    expect(rows.every((r) => !r.available && r.prices.length === 0 && r.bestPrice === null)).toBe(true);
  });

  it("maps prices, renewal, 3-year total, promo and status from the backend", () => {
    const [row] = mapBackendToFrontend([item()], ["acme"], ["com"]);
    expect(row.available).toBe(true);
    expect(row.bestPrice).toBe(8.98);
    expect(row.prices[0]).toEqual({
      registrar: "Spaceship",
      available: true,
      registerPrice: 8.98,
      renewalPrice: 9.98,
      status: "available",
      threeYearTotal: 28.94,
      isPromo: true,
      premium: false,
    });
    expect(row.prices[1].registerPrice).toBe(11.28);
  });

  it("does not treat an unknown (failed) check as available", () => {
    const [row] = mapBackendToFrontend(
      [
        item({
          bestPrice: null,
          results: [{ registrar: "Namecheap", available: false, status: "unknown" }],
        }),
      ],
      ["acme"],
      ["com"]
    );
    expect(row.available).toBe(false);
    expect(row.prices[0]).toMatchObject({ status: "unknown", registerPrice: null, renewalPrice: null });
  });

  it("matches results with a leading-dot TLD and ignores results nobody asked for", () => {
    const rows = mapBackendToFrontend(
      [item({ tld: ".com" }), item({ domain: "other" })],
      ["acme"],
      ["com"]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].available).toBe(true);
  });
});

describe("mapBackendToFrontend: links, conversions, techniques", () => {
  it("passes through buy links, original prices and word-engine techniques", () => {
    const [row] = mapBackendToFrontend(
      [
        {
          domain: "ledgerly",
          tld: "com",
          bestPrice: 9.37,
          results: [
            {
              registrar: "OVHcloud",
              available: true,
              status: "available",
              price: 9.37,
              originalCurrency: "EUR",
              originalPrice: 8.49,
              purchaseUrl: "https://ovh.test/ledgerly.com",
            },
          ],
        },
      ],
      ["ledgerly"],
      [".com"],
      { ledgerly: "affix" }
    );
    expect(row.technique).toBe("affix");
    expect(row.prices[0]).toEqual(
      expect.objectContaining({
        originalCurrency: "EUR",
        originalPrice: 8.49,
        purchaseUrl: "https://ovh.test/ledgerly.com",
      })
    );
  });
});
