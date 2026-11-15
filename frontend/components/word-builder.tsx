"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/config";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import type { Feel, GeneratedName, Technique, WordEngineConfig } from "@/lib/types";

export const TECHNIQUE_INFO: Record<Technique, { label: string; example: string; hint: string }> = {
  compound: { label: "Compound", example: "YouTube", hint: "Join two words" },
  blend: { label: "Blend", example: "Pinterest", hint: "Merge where words overlap" },
  affix: { label: "Prefix / suffix", example: "Spotify", hint: "Add -ify, -ly, get-, …" },
  clip: { label: "Clip", example: "Insta", hint: "Shorten + vowel ending" },
  respell: { label: "Respell", example: "Flickr", hint: "Drop or swap letters" },
  rhyme: { label: "Rhyme", example: "Zillow", hint: "Swap the first sound" },
  alliterate: { label: "Alliterate", example: "PayPal", hint: "Same first letter" },
  coin: { label: "Syllable pattern", example: "Kodak", hint: "Invent from C/V patterns" },
  markov: { label: "Invented word", example: "Zalando", hint: "Sounds English, isn't" },
};

const ALL_TECHNIQUES = Object.keys(TECHNIQUE_INFO) as Technique[];
const DEFAULT_TECHNIQUES: Technique[] = ["compound", "blend", "affix", "clip", "respell", "rhyme", "coin"];
const PATTERN_PRESETS = ["CVCV", "CVCCV", "CVCVC", "VCV", "CVVC"];
const FEELS: Array<{ id: Feel; label: string; hint: string }> = [
  { id: "neutral", label: "Neutral", hint: "No preference" },
  { id: "light", label: "Light & quick", hint: "i/e vowels, soft consonants" },
  { id: "strong", label: "Bold & solid", hint: "o/u/a vowels, hard consonants" },
];

export const DEFAULT_WORD_CONFIG: WordEngineConfig = {
  seeds: [],
  strategies: DEFAULT_TECHNIQUES,
  patterns: ["CVCV", "CVCCV"],
  prefixes: [],
  suffixes: [],
  useBuiltInAffixes: true,
  minLen: 4,
  maxLen: 12,
  feel: "neutral",
  seed: 1,
};

const splitList = (text: string) =>
  text
    .split(/[\s,]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

interface WordBuilderProps {
  value: WordEngineConfig;
  onChange: (next: WordEngineConfig) => void;
}

/** Configure the rule-based word engine and preview its names live. */
export function WordBuilder({ value, onChange }: WordBuilderProps) {
  const set = (patch: Partial<WordEngineConfig>) => onChange({ ...value, ...patch });
  const strategies = value.strategies ?? [];
  const patterns = value.patterns ?? [];
  const [seedDraft, setSeedDraft] = useState("");
  const [patternDraft, setPatternDraft] = useState("");

  const addSeeds = (text: string) => {
    const words = splitList(text).filter((w) => !value.seeds.includes(w));
    if (words.length) set({ seeds: [...value.seeds, ...words].slice(0, 5) });
    setSeedDraft("");
  };

  const onSeedKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSeeds(seedDraft);
    } else if (e.key === "Backspace" && !seedDraft && value.seeds.length) {
      set({ seeds: value.seeds.slice(0, -1) });
    }
  };

  const toggleTechnique = (t: Technique) =>
    set({
      strategies: strategies.includes(t) ? strategies.filter((x) => x !== t) : [...strategies, t],
    });

  const togglePattern = (p: string) =>
    set({ patterns: patterns.includes(p) ? patterns.filter((x) => x !== p) : [...patterns, p] });

  const customPatternValid = /^[CVcv]{2,10}$/.test(patternDraft);
  const usesPatterns = strategies.includes("coin");
  const usesAffixes = strategies.includes("affix");

  return (
    <div className="space-y-5">
      {/* Seeds */}
      <div className="space-y-2">
        <label htmlFor="seed-input" className="text-sm font-medium text-foreground">
          Your words
        </label>
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          {value.seeds.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary"
            >
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => set({ seeds: value.seeds.filter((x) => x !== s) })}
                className="text-primary/70 hover:text-primary"
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="seed-input"
            value={seedDraft}
            onChange={(e) => setSeedDraft(e.target.value)}
            onKeyDown={onSeedKey}
            onBlur={() => seedDraft && addSeeds(seedDraft)}
            placeholder={value.seeds.length ? "" : "e.g. your name, ledger, fast"}
            className="min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Up to 5 words: your name, keywords, anything. Press Enter after each. Leave empty to invent
          brand-new words.
        </p>
      </div>

      {/* Techniques */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Techniques</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {ALL_TECHNIQUES.map((t) => {
            const on = strategies.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTechnique(t)}
                title={TECHNIQUE_INFO[t].hint}
                className={cn(
                  "flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                  on ? "border-primary bg-primary/[0.06]" : "border-border hover:border-muted-foreground/40"
                )}
              >
                <span className="text-xs font-medium text-foreground">{TECHNIQUE_INFO[t].label}</span>
                <span className="text-[11px] text-muted-foreground">like {TECHNIQUE_INFO[t].example}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Syllable patterns */}
      {usesPatterns && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Syllable patterns{" "}
            <span className="font-normal text-muted-foreground">(C = consonant, V = vowel)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...PATTERN_PRESETS, ...patterns])].map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={patterns.includes(p)}
                onClick={() => togglePattern(p)}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-xs transition-colors",
                  patterns.includes(p)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
            <input
              aria-label="Custom pattern"
              value={patternDraft}
              onChange={(e) => setPatternDraft(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (customPatternValid && !patterns.includes(patternDraft)) {
                    set({ patterns: [...patterns, patternDraft] });
                    setPatternDraft("");
                  }
                }
              }}
              placeholder="Custom…"
              className={cn(
                "w-24 rounded-md border bg-background px-2 py-1 font-mono text-xs focus:outline-none",
                patternDraft && !customPatternValid ? "border-destructive" : "border-border"
              )}
            />
          </div>
        </div>
      )}

      {/* Custom affixes */}
      {usesAffixes && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Prefixes</span>
            <input
              defaultValue={(value.prefixes ?? []).join(", ")}
              onBlur={(e) => set({ prefixes: splitList(e.target.value) })}
              placeholder="get, try, my"
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Suffixes</span>
            <input
              defaultValue={(value.suffixes ?? []).join(", ")}
              onBlur={(e) => set({ suffixes: splitList(e.target.value) })}
              placeholder="ly, ify, hub"
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={value.useBuiltInAffixes ?? true}
              onChange={(e) => set({ useBuiltInAffixes: e.target.checked })}
            />
            Also use the built-in list (~120 common startup prefixes and suffixes)
          </label>
        </div>
      )}

      {/* Length + feel */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Length</span>
          <div className="flex items-center gap-2 text-sm">
            <input
              type="number"
              aria-label="Minimum length"
              min={2}
              max={value.maxLen ?? 12}
              value={value.minLen ?? 4}
              onChange={(e) => set({ minLen: Number(e.target.value) })}
              className="h-9 w-16 rounded-lg border border-input bg-background px-2"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="number"
              aria-label="Maximum length"
              min={value.minLen ?? 4}
              max={30}
              value={value.maxLen ?? 12}
              onChange={(e) => set({ maxLen: Number(e.target.value) })}
              className="h-9 w-16 rounded-lg border border-input bg-background px-2"
            />
            <span className="text-muted-foreground">letters</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Feel</span>
          <div className="flex rounded-lg bg-muted p-0.5">
            {FEELS.map((f) => (
              <button
                key={f.id}
                type="button"
                title={f.hint}
                aria-pressed={value.feel === f.id}
                onClick={() => set({ feel: f.id })}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                  value.feel === f.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <WordPreview config={value} onShuffle={() => set({ seed: (value.seed ?? 1) + 1 })} />
    </div>
  );
}

/** Debounced live preview (free, rate-limited on the server). */
function WordPreview({ config, onShuffle }: { config: WordEngineConfig; onShuffle: () => void }) {
  const { token, isAuthenticated, setAuthOpen } = useDomainQStore();
  const [names, setNames] = useState<GeneratedName[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error" | "limited">("idle");
  const requestId = useRef(0);
  const key = JSON.stringify(config);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setState("loading");
      try {
        const res = await fetch(`${API_BASE_URL}/api/namegen/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...JSON.parse(key), count: 24 }),
        });
        if (id !== requestId.current) return;
        if (res.status === 429) return setState("limited");
        if (!res.ok) return setState("error");
        setNames(((await res.json()) as { names: GeneratedName[] }).names);
        setState("idle");
      } catch {
        if (id === requestId.current) setState("error");
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [key, token, isAuthenticated]);

  return (
    <div className="rounded-lg border border-dashed border-border p-3" data-testid="word-preview">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preview {state === "loading" && "…"}
        </span>
        {isAuthenticated && (
          <button type="button" onClick={onShuffle} className="text-xs text-primary hover:underline">
            Shuffle
          </button>
        )}
      </div>
      {!isAuthenticated ? (
        <p className="text-xs text-muted-foreground">
          <button type="button" className="text-primary hover:underline" onClick={() => setAuthOpen(true)}>
            Sign in
          </button>{" "}
          to preview names as you build. Previews are free.
        </p>
      ) : state === "limited" ? (
        <p className="text-xs text-muted-foreground">Too many previews. Wait a few seconds…</p>
      ) : state === "error" ? (
        <p className="text-xs text-destructive">Couldn&apos;t load a preview.</p>
      ) : names.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add a word or pick a technique to see names.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {names.map((n) => (
            <span
              key={n.name}
              title={TECHNIQUE_INFO[n.technique]?.label}
              className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
            >
              {n.name}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Searching checks the top 15 names across your extensions, with full price comparison.
      </p>
    </div>
  );
}
