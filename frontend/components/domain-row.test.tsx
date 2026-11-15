import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { DomainResult, RegistrarPrice } from "@/lib/types";

vi.mock("@/lib/store/use-domainq-store", () => ({
  useDomainQStore: () => ({
    isAuthenticated: false,
    isBookmarked: () => false,
    toggleBookmark: vi.fn(),
  }),
}));

import { DomainRow } from "./domain-row";

const price = (overrides: Partial<RegistrarPrice>): RegistrarPrice => ({
  registrar: "Spaceship",
  available: true,
  status: "available",
  registerPrice: 8.98,
  renewalPrice: 9.98,
  threeYearTotal: 28.94,
  isPromo: false,
  premium: false,
  ...overrides,
});

const result = (prices: RegistrarPrice[]): DomainResult => ({
  domain: "acme.com",
  name: "acme",
  extension: ".com",
  available: prices.some((p) => p.available),
  bestPrice: prices.find((p) => p.available)?.registerPrice ?? null,
  prices,
});

/** Render a row and expand it to show the per-registrar table. */
function renderExpanded(prices: RegistrarPrice[]) {
  render(<DomainRow result={result(prices)} index={0} />);
  fireEvent.click(screen.getAllByText("acme")[0]);
}

describe("DomainRow registrar badges", () => {
  it("shows Available with register and renewal prices", () => {
    renderExpanded([price({})]);
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getAllByText("$8.98").length).toBeGreaterThan(0);
    expect(screen.getByText("$9.98")).toBeInTheDocument();
  });

  it("shows Taken for a registered name", () => {
    renderExpanded([price({ available: false, status: "taken", registerPrice: null, renewalPrice: null })]);
    // Summary row + registrar badge
    expect(screen.getAllByText("Taken")).toHaveLength(2);
  });

  it("shows Unknown (not Taken) when the registrar check failed", () => {
    renderExpanded([price({ available: false, status: "unknown", registerPrice: null, renewalPrice: null })]);
    expect(screen.getAllByText("Unknown")).toHaveLength(2);
    expect(screen.queryByText("Taken")).not.toBeInTheDocument();
  });

  it("shows Premium for available premium names", () => {
    renderExpanded([price({ premium: true, registerPrice: 2500, renewalPrice: 12 })]);
    expect(screen.getByText("Premium")).toBeInTheDocument();
  });

  it("marks first-year promo prices and exposes the 3-year total", () => {
    renderExpanded([price({ isPromo: true })]);
    expect(screen.getByText("(1st-yr promo)")).toBeInTheDocument();
    expect(screen.getByTitle("3-year total: $28.94")).toBeInTheDocument();
  });
});

describe("DomainRow buy links and converted prices", () => {
  it("links to the registrar and shows the original currency on hover", () => {
    renderExpanded([
      price({
        registrar: "WhoGoHost",
        registerPrice: 11.09,
        originalCurrency: "NGN",
        originalPrice: 14999,
        purchaseUrl: "https://www.whogohost.com/host/cart.php?a=add&domain=register&query=acme.com",
      }),
    ]);
    const link = screen.getByRole("link", { name: "Buy at WhoGoHost" });
    expect(link).toHaveAttribute("href", expect.stringContaining("whogohost.com"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("sponsored"));
    expect(screen.getByTitle(/Charged as NGN\s?14,999/)).toBeInTheDocument();
  });

  it("hides the buy link when the name is taken", () => {
    renderExpanded([
      price({ available: false, status: "taken", purchaseUrl: "https://x.test", registerPrice: null }),
    ]);
    expect(screen.queryByRole("link", { name: /Buy at/ })).not.toBeInTheDocument();
  });
});
