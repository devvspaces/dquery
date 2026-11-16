import { describe, expect, it } from "vitest";
import {
  countResults,
  filterResults,
  groupByName,
  NO_FILTERS,
  sortResults,
  timeAgo,
} from "@/lib/results-view";
import { checkedRow, markPending, mergeResults, pendingRow, type BackendCheckItem } from "@/lib/map-results";
import { rowsFromSaved } from "@/lib/hooks/use-search-session";
import type { DomainResult } from "@/lib/types";

const item = (domain: string, tld: string, price: number | null): BackendCheckItem => ({
  domain,
  tld,
  bestPrice: price,
  results:
    price === null
      ? [{ registrar: "A", available: false, status: "taken" }]
      : [
          { registrar: "Pricey", available: true, status: "available", price: price + 5 },
          { registrar: "Cheap", available: true, status: "available", price },
        ],
});

const rows = (): DomainResult[] => [
  checkedRow(item("brewly", "com", null)),
  checkedRow(item("brewly", "io", 28)),
  pendingRow("beanery", "com"),
  checkedRow(item("beanery", "io", 9.8)),
  checkedRow({ ...item("roast", "ai", null), results: [{ registrar: "A", available: false, status: "unknown" }] }),
];

describe("counts", () => {
  it("never counts pending rows as taken", () => {
    expect(countResults(rows())).toEqual({ total: 5, checked: 4, pending: 1, available: 2, taken: 1, unknown: 1 });
  });
});

describe("filters", () => {
  it("narrows by availability, extension, price and text", () => {
    expect(filterResults(rows(), { ...NO_FILTERS, availableOnly: true }).map((r) => r.domain)).toEqual([
      "brewly.io",
      "beanery.io",
    ]);
    expect(filterResults(rows(), { ...NO_FILTERS, tlds: [".com"] })).toHaveLength(2);
    expect(filterResults(rows(), { ...NO_FILTERS, maxPrice: 10 }).map((r) => r.domain)).toEqual(["beanery.io"]);
    expect(filterResults(rows(), { ...NO_FILTERS, query: "bean" })).toHaveLength(2);
  });
});

describe("sorting", () => {
  it("keeps the original order by default so streaming rows don't jump", () => {
    const r = rows();
    expect(sortResults(r, "original")).toBe(r);
  });

  it("puts the cheapest available first, then pending, then the rest", () => {
    expect(sortResults(rows(), "cheapest").map((r) => r.domain)).toEqual([
      "beanery.io",
      "brewly.io",
      "beanery.com",
      "brewly.com",
      "roast.ai",
    ]);
  });

  it("sorts extensions alphabetically, not by length", () => {
    expect(sortResults(rows(), "extension").map((r) => r.extension)).toEqual([".ai", ".com", ".com", ".io", ".io"]);
  });
});

describe("grouping", () => {
  it("makes one group per name with its best offer", () => {
    const groups = groupByName(rows(), "original", [".com", ".io", ".ai"]);
    expect(groups.map((g) => g.name)).toEqual(["brewly", "beanery", "roast"]);
    expect(groups[1]).toMatchObject({ available: 1, pending: 1 });
    expect(groups[1].best?.domain).toBe("beanery.io");
    expect(groupByName(rows(), "cheapest").map((g) => g.name)).toEqual(["beanery", "brewly", "roast"]);
  });
});

describe("merging streamed results", () => {
  it("updates rows in place and appends new ones; offers come cheapest first", () => {
    const base = markPending([], [{ domain: "a", tld: "com" }, { domain: "b", tld: "com" }]);
    expect(base.map((r) => r.status)).toEqual(["pending", "pending"]);
    const next = mergeResults(base, [item("b", "com", 12), item("c", "io", null)]);
    expect(next.map((r) => [r.domain, r.status])).toEqual([
      ["a.com", "pending"],
      ["b.com", "available"],
      ["c.io", "taken"],
    ]);
    expect(next[1].prices[0].registrar).toBe("Cheap");
  });

  it("re-check resets only the chosen rows to pending", () => {
    const r = markPending(rows(), [{ domain: "brewly", tld: "io" }]);
    expect(r.find((x) => x.domain === "brewly.io")?.status).toBe("pending");
    expect(r.find((x) => x.domain === "beanery.io")?.status).toBe("available");
  });

  it("orders a saved search by its names, then extensions", () => {
    const saved = rowsFromSaved({
      id: "s",
      kind: "generate",
      title: "t",
      businessName: "t",
      description: null,
      input: null,
      names: ["zed", "amp"],
      techniques: { amp: "blend" },
      tlds: ["io", "com"],
      pinned: false,
      createdAt: "",
      updatedAt: "",
      lastCheckedAt: null,
      results: [item("amp", "com", 5), item("zed", "com", null), item("amp", "io", 7), item("zed", "io", 3)],
    });
    expect(saved.map((r) => r.domain)).toEqual(["zed.io", "zed.com", "amp.io", "amp.com"]);
    expect(saved[2].technique).toBe("blend");
  });
});

describe("timeAgo", () => {
  it("reads naturally", () => {
    const now = Date.parse("2026-11-16T12:00:00Z");
    expect(timeAgo("2026-11-16T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-11-16T10:00:00Z", now)).toBe("2h ago");
    expect(timeAgo("2026-11-13T12:00:00Z", now)).toBe("3d ago");
    expect(timeAgo(null, now)).toBe("never");
  });
});
