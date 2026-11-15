import { describe, expect, it } from "vitest";
import { buildCheckPairs } from "./search-defaults";

const fq = (pairs: Array<{ domain: string; tld: string }>) => pairs.map((p) => `${p.domain}.${p.tld}`);

describe("buildCheckPairs", () => {
  it("checks a bare name across the chosen extensions", () => {
    expect(fq(buildCheckPairs("Acme", [".com", ".io"]))).toEqual(["acme.com", "acme.io"]);
  });
  it("keeps a typed extension and adds the chosen ones without duplicates", () => {
    expect(fq(buildCheckPairs("acme.com", [".com", ".dev"]))).toEqual(["acme.com", "acme.dev"]);
    expect(fq(buildCheckPairs("acme.co.uk", [".com"]))).toEqual(["acme.co.uk", "acme.com"]);
  });
  it("accepts pasted URLs", () => {
    expect(fq(buildCheckPairs(" https://www.Acme.com/about ", []))).toEqual(["acme.com"]);
  });
  it("rejects invalid names", () => {
    expect(buildCheckPairs("-bad-", [".com"])).toEqual([]);
    expect(buildCheckPairs("", [".com"])).toEqual([]);
  });
});
