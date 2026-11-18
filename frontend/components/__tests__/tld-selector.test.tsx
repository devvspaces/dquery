import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithClient } from "@/lib/test-utils";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { TldSelector } from "@/components/tld-selector";

const index = {
  count: 4,
  checkable: 3,
  tlds: [
    { tld: "com", from: 9.98, registrars: 4, category: "Popular", checkable: true },
    { tld: "io", from: 32.5, registrars: 3, category: "Popular", checkable: true },
    { tld: "ng", from: 14, registrars: 1, category: "Country", checkable: false },
    { tld: "com.ng", from: 6, registrars: 2, category: "Country", checkable: true },
  ],
};

function Harness({ initial = [] as string[], max }: { initial?: string[]; max?: number }) {
  const [sel, setSel] = useState(initial);
  return (
    <TldSelector
      selected={sel}
      max={max}
      onToggle={(t) => setSel((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
    />
  );
}

describe("TldSelector", () => {
  beforeEach(() => useDomainQStore.setState({ pricing: null }));
  afterEach(() => vi.unstubAllGlobals());

  it("lists the live catalog with prices and finds countries by name", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    renderWithClient(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: /Browse 3 extensions/ }));
    expect(screen.getByRole("button", { name: /\.com\s*\$9\.98/ })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search extensions"), { target: { value: "nigeria" } });
    const ng = screen.getByRole("button", { name: /^\.ng/ }) as HTMLButtonElement;
    expect(ng.disabled).toBe(true);
    expect(ng.textContent).toContain("prices only");
    fireEvent.click(screen.getByRole("button", { name: /\.com\.ng/ }));
    expect(screen.getByRole("button", { name: "Remove .com.ng" })).toBeTruthy();
  });

  it("uses the server limit and disables adding at the cap", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(index))));
    useDomainQStore.setState({ pricing: { perAiGeneration: 1, perWordGeneration: 1, perDomainCheck: 1, maxTlds: 1 } });
    renderWithClient(<Harness initial={[".com"]} />);
    expect(screen.getByText("1/1")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /Browse 3 extensions/ }));
    expect((screen.getByRole("button", { name: /^\.io/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Up to 1 extensions per search/)).toBeTruthy();
  });

  it("falls back to the curated list when the index can't load", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Browse & add extensions/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /^\.com/ })).toBeTruthy();
    expect(screen.getByText("0/10")).toBeTruthy();
  });
});
