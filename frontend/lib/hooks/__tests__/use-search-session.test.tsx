import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSearchSession } from "@/lib/hooks/use-search-session";
import { useDomainQStore } from "@/lib/store/use-domainq-store";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() }) }));
import { toast } from "sonner";

/** Minimal EventSource stand-in the test can drive. */
class FakeSource {
  static last: FakeSource | null = null;
  listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
  closed = false;
  constructor(public url: string) {
    FakeSource.last = this;
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  emit(type: string, data?: unknown) {
    for (const fn of this.listeners[type] ?? []) fn({ data: JSON.stringify(data) } as MessageEvent);
  }
  close() {
    this.closed = true;
  }
}

const SEARCH_ID = "11111111-1111-1111-1111-111111111111";
const offer = (price: number) => ({ registrar: "Reg", available: true, status: "available", price });
let fetchMock: ReturnType<typeof vi.fn>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.stubGlobal("EventSource", FakeSource);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  useDomainQStore.setState({ token: "t", fetchProfile: vi.fn() as never });
  window.history.replaceState(null, "", "/search");
});
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

describe("useSearchSession", () => {
  it("opens a saved search for free and puts it in the URL", async () => {
    fetchMock.mockReturnValueOnce(
      json({
        id: SEARCH_ID,
        kind: "check",
        title: "acme",
        businessName: "acme",
        description: null,
        input: null,
        names: ["acme"],
        techniques: {},
        tlds: ["com"],
        pinned: false,
        createdAt: "",
        updatedAt: "",
        lastCheckedAt: null,
        results: [{ domain: "acme", tld: "com", bestPrice: 9, results: [offer(9)] }],
      })
    );
    const { result } = renderHook(() => useSearchSession({ onInsufficientCredits: vi.fn() }), { wrapper });
    await act(() => result.current.load(SEARCH_ID));
    expect(result.current.phase).toBe("results");
    expect(result.current.rows.map((r) => [r.domain, r.status])).toEqual([["acme.com", "available"]]);
    expect(window.location.search).toBe(`?s=${SEARCH_ID}`);
    expect(fetchMock.mock.calls[0][0]).toContain(`/api/searches/${SEARCH_ID}`);
  });

  it("streams a check, then marks never-answered domains unknown (not taken) and offers a retry", async () => {
    fetchMock.mockReturnValueOnce(json({ sseUrl: "/api/domains/batch/b1/stream", searchId: SEARCH_ID }));
    const { result } = renderHook(() => useSearchSession({ onInsufficientCredits: vi.fn() }), { wrapper });
    await act(() =>
      result.current.check(
        [
          { domain: "a", tld: "com" },
          { domain: "b", tld: "com" },
        ],
        { fresh: true, title: "a" }
      )
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ title: "a", domains: [{ domain: "a" }, { domain: "b" }] });
    expect(result.current.rows.every((r) => r.status === "pending")).toBe(true);
    expect(result.current.meta?.id).toBe(SEARCH_ID);

    act(() =>
      FakeSource.last!.emit("batch:update", {
        completed: 0,
        failed: 1,
        total: 1,
        results: [{ domain: "a", tld: "com", bestPrice: 5, results: [offer(5)] }],
      })
    );
    await waitFor(() => expect(result.current.progress.running).toBe(false));
    expect(result.current.rows.map((r) => r.status)).toEqual(["available", "unknown"]);
    expect(FakeSource.last!.closed).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("didn't finish"), expect.anything());
  });

  it("opens the credits dialog when a check can't be afforded", async () => {
    fetchMock.mockReturnValueOnce(json({ required: 1, available: 0 }, 402));
    const onInsufficientCredits = vi.fn();
    const { result } = renderHook(() => useSearchSession({ onInsufficientCredits }), { wrapper });
    await act(() => result.current.check([{ domain: "a", tld: "com" }], { fresh: true }));
    expect(onInsufficientCredits).toHaveBeenCalled();
    expect(result.current.rows).toEqual([]);
  });
});
