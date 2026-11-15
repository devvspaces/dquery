import { describe, expect, it } from "vitest";
import { estimateChecks, estimateGeneration, formatCredits } from "./pricing";

const pricing = { perAiGeneration: 1, perWordGeneration: 0.25, perDomainCheck: 0.05 };

describe("pricing", () => {
  it("matches the backend quote for an AI search", () => {
    expect(estimateGeneration(pricing, "ai", 15, 3)).toBe(3.25);
  });
  it("charges less for the word engine", () => {
    expect(estimateGeneration(pricing, "words", 15, 3)).toBe(2.5);
  });
  it("prices plain checks per domain", () => {
    expect(estimateChecks(pricing, 8)).toBe(0.4);
  });
  it("formats credits without float noise", () => {
    expect(formatCredits(9.499999999)).toBe("9.5");
    expect(formatCredits(10)).toBe("10");
    expect(formatCredits(undefined)).toBe("0");
  });
});
