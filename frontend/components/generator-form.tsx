"use client";

import React from "react"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TldSelector, DEFAULT_SELECTED } from "@/components/tld-selector";
import { CostNote } from "@/components/cost-note";
import { estimateGeneration } from "@/lib/pricing";
import { GENERATION_COUNT, MAX_TLDS } from "@/lib/search-defaults";
import { WordBuilder, DEFAULT_WORD_CONFIG } from "@/components/word-builder";
import { cn } from "@/lib/utils";
import type { GenerateRequest, WordEngineConfig } from "@/lib/types";

interface GeneratorFormProps {
  onGenerate: (data: GenerateRequest) => void;
  isLoading: boolean;
}

type Engine = GenerateRequest["engine"];

export function GeneratorForm({ onGenerate, isLoading }: GeneratorFormProps) {
  const [engine, setEngine] = useState<Engine>("ai");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [wordConfig, setWordConfig] = useState<WordEngineConfig>(DEFAULT_WORD_CONFIG);
  const [selectedTlds, setSelectedTlds] = useState<string[]>(DEFAULT_SELECTED);

  const handleToggleTld = (tld: string) => {
    setSelectedTlds((prev) =>
      prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld]
    );
  };

  const tooManyTlds = selectedTlds.length > MAX_TLDS;
  const wordsReady =
    (wordConfig.strategies?.length ?? 0) > 0 &&
    (wordConfig.seeds.length > 0 ||
      wordConfig.strategies!.some((s) => s === "coin" || s === "markov"));
  const isValid =
    selectedTlds.length > 0 &&
    !tooManyTlds &&
    (engine === "ai" ? businessName.trim().length > 0 : wordsReady);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onGenerate({
      engine,
      businessName: businessName.trim(),
      description: description.trim(),
      tlds: selectedTlds,
      wordEngine: engine === "words" ? wordConfig : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Generator">
        {(
          [
            ["ai", "AI ideas", "Describe your business"],
            ["words", "Word builder", "Combine your own words, no AI"],
          ] as const
        ).map(([id, label, hint]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={engine === id}
            title={hint}
            onClick={() => setEngine(id)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              engine === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {engine === "words" ? (
        <WordBuilder value={wordConfig} onChange={setWordConfig} />
      ) : (
      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="businessName"
            className="text-sm font-medium text-foreground"
          >
            Business name
          </label>
          <input
            id="businessName"
            type="text"
            placeholder="e.g. Acme Technologies"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="description"
            className="text-sm font-medium text-foreground"
          >
            Description{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <textarea
            id="description"
            placeholder="Brief description of your business, product, or idea..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="flex w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
          />
        </div>
      </div>
      )}

      <TldSelector selected={selectedTlds} onToggle={handleToggleTld} />

      <Button
        type="submit"
        disabled={!isValid || isLoading}
        className="w-full h-10 text-sm font-medium"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse_dot" />
              <span
                className="h-1.5 w-1.5 rounded-full bg-current animate-pulse_dot"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-current animate-pulse_dot"
                style={{ animationDelay: "0.4s" }}
              />
            </span>
            Generating domains...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
            {engine === "words" ? "Build & check names" : "Generate domain names"}
          </span>
        )}
      </Button>
      {tooManyTlds ? (
        <p className="text-center text-xs text-destructive">
          Pick at most {MAX_TLDS} extensions.
        </p>
      ) : (
        <CostNote
          cost={(p) =>
            selectedTlds.length
              ? estimateGeneration(p, engine, GENERATION_COUNT, selectedTlds.length)
              : null
          }
          detail={`${GENERATION_COUNT} names × ${selectedTlds.length} extension${selectedTlds.length === 1 ? "" : "s"}`}
        />
      )}
    </form>
  );
}
