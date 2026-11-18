import { describe, expect, it } from "vitest";
import { filterByCategory, searchTlds, type TldEntry } from "./tld-index";

const e = (tld: string, category: TldEntry["category"] = "Other", checkable = true): TldEntry => ({
  tld,
  from: 1,
  registrars: 1,
  category,
  checkable,
});
const entries = [e("com", "Popular"), e("io", "Popular"), e("ng", "Country"), e("com.ng", "Country"), e("ionic"), e("shop", "Commerce")];

describe("searchTlds", () => {
  it("finds a ccTLD and its second levels by country name", () => {
    expect(searchTlds(entries, "nigeria").map((t) => t.tld)).toEqual(["ng", "com.ng"]);
    expect(searchTlds(entries, "nig").map((t) => t.tld)).toEqual(["ng", "com.ng"]);
  });

  it("ranks the exact match first and ignores a leading dot", () => {
    expect(searchTlds(entries, ".io").map((t) => t.tld)).toEqual(["io", "ionic"]);
  });

  it("returns everything for an empty query", () => {
    expect(searchTlds(entries, "  ")).toHaveLength(entries.length);
  });
});

describe("filterByCategory", () => {
  it("filters, with All as a pass-through", () => {
    expect(filterByCategory(entries, "Country").map((t) => t.tld)).toEqual(["ng", "com.ng"]);
    expect(filterByCategory(entries, "All")).toHaveLength(entries.length);
  });
});
