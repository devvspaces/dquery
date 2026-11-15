import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { WordBuilder, DEFAULT_WORD_CONFIG } from "./word-builder";
import { GeneratorForm } from "./generator-form";
import type { WordEngineConfig } from "@/lib/types";

function Harness({ onConfig }: { onConfig: (c: WordEngineConfig) => void }) {
  const [config, setConfig] = useState(DEFAULT_WORD_CONFIG);
  return (
    <WordBuilder
      value={config}
      onChange={(c) => {
        setConfig(c);
        onConfig(c);
      }}
    />
  );
}

describe("WordBuilder", () => {
  beforeEach(() => {
    useDomainQStore.setState({
      pricing: { perAiGeneration: 1, perWordGeneration: 0.25, perDomainCheck: 0.05 },
      isAuthenticated: false,
      token: null,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("adds seed words as chips and removes them", () => {
    let last = DEFAULT_WORD_CONFIG;
    render(<Harness onConfig={(c) => (last = c)} />);
    const input = screen.getByLabelText("Your words");
    fireEvent.change(input, { target: { value: "Ayo, ledger" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(last.seeds).toEqual(["ayo", "ledger"]);
    fireEvent.click(screen.getByLabelText("Remove ayo"));
    expect(last.seeds).toEqual(["ledger"]);
  });

  it("toggles techniques and adds a custom syllable pattern", () => {
    let last = DEFAULT_WORD_CONFIG;
    render(<Harness onConfig={(c) => (last = c)} />);
    fireEvent.click(screen.getByText("Blend"));
    expect(last.strategies).not.toContain("blend");
    const custom = screen.getByLabelText("Custom pattern");
    fireEvent.change(custom, { target: { value: "cvccvc" } });
    fireEvent.keyDown(custom, { key: "Enter" });
    expect(last.patterns).toContain("CVCCVC");
  });

  it("asks signed-out users to sign in before previewing", () => {
    render(<Harness onConfig={() => {}} />);
    expect(screen.getByTestId("word-preview").textContent).toContain("Sign in");
  });

  it("previews names for signed-in users", async () => {
    vi.useFakeTimers();
    useDomainQStore.setState({ isAuthenticated: true, token: "t" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ names: [{ name: "ledgerly", technique: "affix", score: 0.8 }] }), {
        status: 200,
      })
    );
    render(<Harness onConfig={() => {}} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/namegen/preview"),
      expect.objectContaining({ method: "POST" })
    );
    expect(screen.getByText("ledgerly")).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("GeneratorForm word builder mode", () => {
  beforeEach(() => {
    useDomainQStore.setState({
      pricing: { perAiGeneration: 1, perWordGeneration: 0.25, perDomainCheck: 0.05 },
      isAuthenticated: false,
      user: null,
    });
  });

  it("prices and submits a word-engine search", () => {
    const onGenerate = vi.fn();
    render(<GeneratorForm onGenerate={onGenerate} isLoading={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "Word builder" }));
    // 0.25 + 15 names × 6 extensions × 0.05 = 4.75
    expect(screen.getByTestId("cost-note").textContent).toContain("4.75 credits");

    const input = screen.getByLabelText("Your words");
    fireEvent.change(input, { target: { value: "ledger" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /build & check names/i }));

    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: "words",
        wordEngine: expect.objectContaining({ seeds: ["ledger"] }),
      })
    );
  });
});
