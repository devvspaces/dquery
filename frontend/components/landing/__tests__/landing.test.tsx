import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { HeroSearch, searchHref } from "@/components/landing/hero-search";
import { TldCheck } from "@/components/landing/tld-check";
import { PriceTable } from "@/components/landing/price-table";
import { buyHref } from "@/components/offer-bits";
import { pickRenewalTrap, type PublicOffer, type PublicCatalog } from "@/lib/public-api";
import { API_BASE_URL } from "@/lib/config";

beforeEach(() => push.mockReset());

describe("hero search", () => {
  it("builds tool links that prefill but never auto-run", () => {
    expect(searchHref("generate", "  coffee delivery ")).toBe("/search?q=coffee+delivery");
    expect(searchHref("check", "acme.io")).toBe("/search?tab=check&q=acme.io");
    expect(searchHref("generate", "")).toBe("/search");
    expect(searchHref("check", "")).toBe("/search?tab=check");
  });

  it("submits the chosen mode and query", () => {
    render(<HeroSearch />);
    fireEvent.click(screen.getByRole("tab", { name: "Check a domain" }));
    fireEvent.change(screen.getByLabelText("Name or domain to check"), { target: { value: "acme.io" } });
    fireEvent.click(screen.getByRole("button", { name: /compare prices/i }));
    expect(push).toHaveBeenCalledWith("/search?tab=check&q=acme.io");
  });

  it("switching mode alone does not navigate", () => {
    render(<HeroSearch />);
    fireEvent.click(screen.getByRole("tab", { name: "Check a domain" }));
    fireEvent.click(screen.getByRole("tab", { name: "Generate names" }));
    expect(push).not.toHaveBeenCalled();
  });
});

describe("extension checker", () => {
  it("adds the page's extension to the typed name", () => {
    render(<TldCheck tld="ai" />);
    fireEvent.change(screen.getByLabelText("Name to check"), { target: { value: "Acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: /check availability/i }));
    expect(push).toHaveBeenCalledWith("/search?tab=check&q=acme.ai");
  });
});

const offer = (id: string, register: number, renewal: number): PublicOffer => ({
  registrarId: id,
  registrar: id.toUpperCase(),
  registerPrice: register,
  renewalPrice: renewal,
  transferPrice: null,
  threeYearTotal: register + renewal * 2,
  isPromo: register < renewal,
  originalCurrency: null,
  originalPrice: null,
  updatedAt: "2026-11-16T00:00:00Z",
});

describe("price table", () => {
  it("highlights only the best 3-year row and collapses the rest", () => {
    const offers = [offer("a", 20, 20), offer("b", 5, 40), offer("c", 30, 30), offer("d", 31, 31)];
    render(<PriceTable offers={offers} limit={2} />);
    expect(screen.getAllByText("Best 3-yr")).toHaveLength(1);
    expect(screen.getByText("A").closest("tr")?.textContent).toContain("Best 3-yr");
    expect(screen.getByText("+2 more registrars")).toBeTruthy();
    expect(screen.queryByText("C")).toBeNull();
  });
});

describe("renewal trap example", () => {
  const summary = (tld: string, registrars: number, reg: number, ren: number, spread: number) => ({
    tld,
    registrars,
    cheapestRegister: reg,
    cheapestRenewal: ren,
    cheapestThreeYear: reg + 2 * ren,
    threeYearSpread: spread,
    updatedAt: "",
  });

  it("prefers a popular, well-compared TLD with the biggest spread", () => {
    const catalog: PublicCatalog = {
      stats: { prices: 0, tlds: 0, registrars: 0 },
      tlds: [
        summary("io", 5, 10, 40, 30),
        summary("xyz", 5, 1, 12, 50),
        summary("weird", 6, 1, 90, 500),
        summary("com", 2, 1, 20, 99), // too few registrars
        summary("net", 5, 10, 11, 80), // no renewal jump
      ],
    };
    expect(pickRenewalTrap(catalog)?.tld).toBe("xyz");
    expect(pickRenewalTrap(null)).toBeNull();
  });
});

describe("buy links", () => {
  it("sends relative click-throughs to the API and leaves full URLs alone", () => {
    expect(buyHref("/api/out/ovh?d=acme.io")).toBe(`${API_BASE_URL}/api/out/ovh?d=acme.io`);
    expect(buyHref("https://porkbun.com/checkout/search?q=acme.io")).toBe("https://porkbun.com/checkout/search?q=acme.io");
  });
});

describe("renewal story", () => {
  it("compares the cheapest-looking other first year with the best 3-year deal", async () => {
    const { renewalStory } = await import("@/lib/public-api");
    // Sorted by 3-year total, as the API returns them.
    const offers = [offer("spaceship", 1.98, 24.98), offer("porkbun", 6.99, 50.98), offer("whogohost", 6.66, 109.09)];
    const story = renewalStory(offers)!;
    expect(story.best.registrarId).toBe("spaceship");
    expect(story.bait.registrarId).toBe("whogohost");
    expect(story.isTrap).toBe(false);
    const trap = renewalStory([offer("steady", 15, 15), offer("bait", 1, 40)])!;
    expect(trap).toMatchObject({ isTrap: true, saving: 36 });
    expect(trap.bait.registrarId).toBe("bait");
    expect(story.saving).toBeCloseTo(224.84 - 51.94, 2);
    expect(renewalStory([offer("a", 1, 1)])).toBeNull();
  });
});
