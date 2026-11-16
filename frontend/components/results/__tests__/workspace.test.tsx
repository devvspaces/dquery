import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ResultsWorkspace } from "@/components/results/results-workspace";
import { checkedRow, pendingRow, type BackendCheckItem } from "@/lib/map-results";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import type { SearchMeta } from "@/lib/hooks/use-search-session";

const item = (domain: string, tld: string, price: number | null): BackendCheckItem => ({
  domain,
  tld,
  bestPrice: price,
  results:
    price === null
      ? [{ registrar: "Reg", available: false, status: "taken" }]
      : [{ registrar: "Reg", available: true, status: "available", price, renewalPrice: price * 3, purchaseUrl: "/api/out/reg?d=x" }],
});

const meta: SearchMeta = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "generate",
  title: "Coffee ideas",
  names: ["brewly", "beanery"],
  techniques: {},
  tlds: [".com", ".io"],
};

const rows = [
  checkedRow(item("brewly", "com", null)),
  checkedRow(item("brewly", "io", 28)),
  pendingRow("beanery", "com"),
  checkedRow(item("beanery", "io", 9.8)),
];

const handlers = () => ({
  onEdit: vi.fn(),
  onNew: vi.fn(),
  onMoreNames: vi.fn(),
  onBackToNames: vi.fn(),
  onRefreshPrices: vi.fn(),
  onRecheck: vi.fn(),
});

beforeEach(() => {
  useDomainQStore.setState({
    pricing: { perAiGeneration: 1, perWordGeneration: 0.25, perDomainCheck: 0.05, perPriceRefresh: 0.01 },
    isAuthenticated: true,
    user: { credits: 10 } as never,
  });
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

describe("results workspace", () => {
  it("shows one card per name with correct counts and progress", () => {
    render(
      <ResultsWorkspace meta={meta} rows={rows} progress={{ running: true, message: "Checking registrars…", done: 3, total: 4 }} {...handlers()} />
    );
    expect(screen.getByText("3 of 4 checked")).toBeTruthy();
    expect(screen.getByText(/2 available/)).toBeTruthy();
    expect(screen.getByText(/1 taken/)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("75");
    const cards = within(screen.getByTestId("name-groups")).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(within(cards[1]).getByRole("button", { name: /beanery\.io: \$9\.80, cheapest/ })).toBeTruthy();
  });

  it("filters to available domains and finds text", () => {
    render(<ResultsWorkspace meta={meta} rows={rows} progress={{ running: false, message: null, done: 0, total: 0 }} {...handlers()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Available only" })[0]);
    expect(screen.getByText("Showing 2 of 4")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Find in results"), { target: { value: "brew" } });
    expect(screen.getByText("Showing 1 of 4")).toBeTruthy();
  });

  it("opens a domain's registrar prices from its chip", () => {
    render(<ResultsWorkspace meta={meta} rows={rows} progress={{ running: false, message: null, done: 0, total: 0 }} {...handlers()} />);
    fireEvent.click(screen.getByRole("button", { name: /brewly\.io: \$28\.00/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Available to register")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "Buy at Reg" })).toBeTruthy();
  });

  it("confirms a price refresh with the cost for available domains only", () => {
    const h = handlers();
    render(<ResultsWorkspace meta={meta} rows={rows} progress={{ running: false, message: null, done: 0, total: 0 }} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /brewly\.io: \$28\.00/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /refresh prices/i }));
    const cost = screen.getByTestId("refresh-cost");
    expect(cost.textContent).toContain("1 domain");
    expect(cost.textContent).toContain("0.01 credits");
    fireEvent.click(screen.getByRole("button", { name: "Refresh prices" }));
    expect(h.onRefreshPrices).toHaveBeenCalledWith([{ domain: "brewly", tld: "io" }]);
  });

  it("selects rows in table view and re-checks just those", () => {
    const h = handlers();
    render(<ResultsWorkspace meta={meta} rows={rows} progress={{ running: false, message: null, done: 0, total: 0 }} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    fireEvent.click(screen.getByLabelText("Select brewly.com"));
    fireEvent.click(screen.getByLabelText("Select beanery.io"));
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Re-check/ }));
    expect(screen.getByTestId("refresh-cost").textContent).toContain("0.1 credits");
    fireEvent.click(screen.getByRole("button", { name: "Re-check now" }));
    expect(h.onRecheck).toHaveBeenCalledWith([
      { domain: "brewly", tld: "com" },
      { domain: "beanery", tld: "io" },
    ]);
  });
});
