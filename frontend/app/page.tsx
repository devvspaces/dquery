"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/header";
import { GeneratorForm } from "@/components/generator-form";
import { CheckerForm } from "@/components/checker-form";
import { ResultsTable } from "@/components/results-table";
import { CheckerResults } from "@/components/checker-results";
import { EmptyStateGenerate, EmptyStateCheck } from "@/components/empty-state";
import { AuthDialog } from "@/components/auth-dialog";
import { CreditsDialog } from "@/components/credits-dialog";
import { AccountSheet } from "@/components/account-sheet";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import type { DomainResult } from "@/lib/types";
import { mapBackendToFrontend } from "@/lib/map-results";
import type { GenerateRequest } from "@/lib/types";
import { API_BASE_URL } from "@/lib/config";
import { buildCheckPairs, GENERATION_COUNT, type DomainPair } from "@/lib/search-defaults";
import { DEFAULT_SELECTED } from "@/components/tld-selector";
import { NameReview, type ReviewState } from "@/components/name-review";
import { InsufficientCreditsError } from "@/lib/pricing";

/** Turn a failed API response into an Error; 402 becomes InsufficientCreditsError. */
async function apiError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 402) {
    return new InsufficientCreditsError(body.required ?? 0, body.available ?? 0);
  }
  return new Error(body.message || fallback);
}

const BACKEND_URL = API_BASE_URL;

export default function Page() {
  const [activeTab, setActiveTab] = useState<"generate" | "check">("generate");
  const [results, setResults] = useState<DomainResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [streamStatusMessage, setStreamStatusMessage] = useState<string | null>(null);
  /** Generated names waiting for the user to pick which to check. */
  const [review, setReview] = useState<ReviewState | null>(null);

  // Zustand Store Hooks
  const {
    isAuthenticated,
    isInitialized,
    authOpen,
    setAuthOpen,
    creditsOpen,
    setCreditsOpen,
    accountOpen,
    setAccountOpen,
    token,
    fetchProfile,
    fetchSavedSearches,
  } = useDomainQStore();

  // Keep references to active EventSources to close them on unmount
  const genSseRef = useRef<EventSource | null>(null);
  const checkSseRef = useRef<EventSource | null>(null);

  const cleanupSse = () => {
    if (genSseRef.current) {
      genSseRef.current.close();
      genSseRef.current = null;
    }
    if (checkSseRef.current) {
      checkSseRef.current.close();
      checkSseRef.current = null;
    }
  };

  useEffect(() => {
    return () => cleanupSse();
  }, []);

  // 1. Pending Search / Resume UX Handshake on mount
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    const pending = localStorage.getItem("pending_search");
    if (pending) {
      try {
        const { type, payload } = JSON.parse(pending);
        localStorage.removeItem("pending_search");

        if (type === "generate") {
          setActiveTab("generate");
          handleGenerate(payload);
        } else if (type === "check") {
          setActiveTab("check");
          handleCheck(payload.domain, payload.tlds ?? DEFAULT_SELECTED);
        }
      } catch (err) {
        console.error("Failed to parse pending search:", err);
      }
    }
  }, [isInitialized, isAuthenticated]);

  const failRequest = useCallback(
    (err: unknown, fallback: string) => {
      console.error(fallback, err);
      if (err instanceof InsufficientCreditsError) {
        setCreditsOpen(true);
      } else {
        alert((err as Error).message || fallback);
      }
      setIsLoading(false);
      setStreamStatusMessage(null);
    },
    [setCreditsOpen]
  );

  // 2. Generate names only (the generation fee is charged); the user reviews them next.
  const handleGenerate = useCallback(
    async (data: GenerateRequest) => {
      const words = data.engine === "words";
      if (!isAuthenticated) {
        localStorage.setItem("pending_search", JSON.stringify({ type: "generate", payload: data }));
        setAuthOpen(true);
        return;
      }

      cleanupSse();
      setIsLoading(true);
      setHasSearched(true);
      setResults([]);
      setReview(null);
      setStreamStatusMessage(words ? "Building names from your words..." : "Generating name ideas with AI...");

      try {
        const res = await fetch(`${BACKEND_URL}/api/domains/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            engine: data.engine,
            autoCheck: false,
            ...(words
              ? { wordEngine: data.wordEngine }
              : { businessName: data.businessName, description: data.description, style: "creative" }),
            count: GENERATION_COUNT,
            tlds: data.tlds.map((t) => t.replace(/^\./, "")),
          }),
        });
        if (!res.ok) throw await apiError(res, "Failed to start name generation");

        const { sseUrl } = await res.json();
        fetchProfile();

        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
        const genSource = new EventSource(`${BACKEND_URL}${sseUrl}${tokenParam}`);
        genSseRef.current = genSource;
        const done = () => {
          genSource.close();
          genSseRef.current = null;
          setIsLoading(false);
          setStreamStatusMessage(null);
        };

        genSource.addEventListener("job:active", () => {
          setStreamStatusMessage(
            words ? "Combining, blending and scoring names..." : "AI is thinking and crafting domains..."
          );
        });
        genSource.addEventListener("job:completed", (event: MessageEvent) => {
          try {
            const { result } = JSON.parse(event.data);
            setReview({
              names: result.domains as string[],
              techniques: (result.techniques ?? {}) as Record<string, string>,
              tlds: data.tlds,
            });
            fetchSavedSearches();
          } catch (err) {
            console.error("Error parsing completion event:", err);
          }
          done();
        });
        genSource.addEventListener("job:failed", (event: MessageEvent) => {
          console.error("Generation job failed:", JSON.parse(event.data).error);
          alert("Name generation failed. Your credits were refunded.");
          done();
          fetchProfile();
        });
        genSource.addEventListener("error", (err) => {
          console.error("Generation SSE stream error:", err);
          done();
        });
      } catch (err) {
        if (err instanceof InsufficientCreditsError) setHasSearched(false);
        failRequest(err, "Something went wrong starting name generation");
      }
    },
    [isAuthenticated, token, fetchProfile, fetchSavedSearches, failRequest, setAuthOpen]
  );

  // 3. Check a set of name × extension pairs (charged per pair) and stream results.
  const runChecks = useCallback(
    async (pairs: DomainPair[], techniques: Record<string, string> = {}) => {
      cleanupSse();
      setIsLoading(true);
      setHasSearched(true);
      setStreamStatusMessage("Starting availability checks...");

      const basenames = [...new Set(pairs.map((p) => p.domain))];
      const tlds = [...new Set(pairs.map((p) => `.${p.tld}`))];
      setResults(mapBackendToFrontend([], basenames, tlds, techniques));

      try {
        const res = await fetch(`${BACKEND_URL}/api/domains/check/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ domains: pairs }),
        });
        if (!res.ok) throw await apiError(res, "Failed to start availability checks");

        const { sseUrl } = await res.json();
        fetchProfile();
        setStreamStatusMessage("Checking registrars in real-time...");
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
        const batchSource = new EventSource(`${BACKEND_URL}${sseUrl}${tokenParam}`);
        checkSseRef.current = batchSource;

        batchSource.addEventListener("batch:update", (event: MessageEvent) => {
          try {
            const batch = JSON.parse(event.data);
            setResults(mapBackendToFrontend(batch.results || [], basenames, tlds, techniques));
            setStreamStatusMessage(`Checking: ${batch.completed}/${batch.total} batches (${batch.progress}%)`);
            if (batch.completed + batch.failed >= batch.total && batch.total > 0) {
              batchSource.close();
              checkSseRef.current = null;
              setIsLoading(false);
              setStreamStatusMessage(null);
              fetchProfile();
            }
          } catch (err) {
            console.error("Error parsing batch event:", err);
          }
        });
        batchSource.addEventListener("error", (err) => {
          console.error("Batch SSE stream error:", err);
          batchSource.close();
          checkSseRef.current = null;
          setIsLoading(false);
          setStreamStatusMessage(null);
        });
      } catch (err) {
        failRequest(err, "Failed to start availability checks");
      }
    },
    [token, fetchProfile, failRequest]
  );

  // Check tab: a typed name/domain across the chosen extensions.
  const handleCheck = useCallback(
    (query: string, tlds: string[]) => {
      if (!isAuthenticated) {
        localStorage.setItem("pending_search", JSON.stringify({ type: "check", payload: { domain: query, tlds } }));
        setAuthOpen(true);
        return;
      }
      const pairs = buildCheckPairs(query, tlds);
      if (pairs.length) void runChecks(pairs);
    },
    [isAuthenticated, runChecks, setAuthOpen]
  );

  // Review step: check only the names the user kept.
  const handleReviewCheck = useCallback(
    (pairs: DomainPair[], techniques: Record<string, string>) => {
      setReview(null);
      void runChecks(pairs, techniques);
    },
    [runChecks]
  );

  const handleTabChange = (tab: "generate" | "check") => {
    cleanupSse();
    setActiveTab(tab);
    setResults([]);
    setReview(null);
    setHasSearched(false);
    setStreamStatusMessage(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSignIn={() => setAuthOpen(true)}
        onBuyCredits={() => setCreditsOpen(true)}
        onOpenAccount={() => setAccountOpen(true)}
      />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          {/* Left panel - Form */}
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground text-balance">
                {activeTab === "generate"
                  ? "Domain name generator"
                  : "Domain availability checker"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {activeTab === "generate"
                  ? "Enter your business details and we will find the perfect domain."
                  : "Check if your desired domain is available across registrars."}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              {activeTab === "generate" ? (
                <GeneratorForm onGenerate={handleGenerate} isLoading={isLoading} />
              ) : (
                <CheckerForm onCheck={handleCheck} isLoading={isLoading} />
              )}
            </div>

            {/* Quick tips */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {activeTab === "generate" ? "Tips" : "How it works"}
              </h3>
              {activeTab === "generate" ? (
                <ul className="space-y-2.5">
                  <TipItem text="Use short, memorable business names for better results" />
                  <TipItem text="Add a description to get more relevant suggestions" />
                  <TipItem text="Review the generated names and keep only the ones you like" />
                  <TipItem text="You only pay to check the names you keep" />
                  <TipItem text="Click any result to compare registrar prices" />
                </ul>
              ) : (
                <ul className="space-y-2.5">
                  <TipItem text="Enter a name like mybiz, or a full domain like mybiz.com" />
                  <TipItem text="Pick the extensions to check it across" />
                  <TipItem text="Expand results to compare prices across registrars" />
                </ul>
              )}
            </div>
          </div>

          {/* Right panel - Results */}
          <div className="min-w-0">
            {/* Real-time Loading Status Info */}
            {isLoading && streamStatusMessage && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground animate-pulse">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>{streamStatusMessage}</span>
              </div>
            )}

            {!hasSearched ? (
              activeTab === "generate" ? (
                <EmptyStateGenerate />
              ) : (
                <EmptyStateCheck />
              )
            ) : activeTab === "generate" && review ? (
              <NameReview
                key={review.names.join(",")}
                review={review}
                isLoading={isLoading}
                onCheck={handleReviewCheck}
                onBack={() => {
                  setReview(null);
                  setHasSearched(false);
                }}
              />
            ) : activeTab === "generate" ? (
              <ResultsTable results={results} isLoading={isLoading && results.length === 0} />
            ) : (
              <CheckerResults results={results} isLoading={isLoading && results.length === 0} />
            )}
          </div>
        </div>
      </main>

      {/* Modals & Sheets */}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <CreditsDialog open={creditsOpen} onOpenChange={setCreditsOpen} />
      <AccountSheet
        open={accountOpen}
        onOpenChange={setAccountOpen}
        onBuyCredits={() => setCreditsOpen(true)}
      />
    </div>
  );
}

function TipItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0 text-primary"
      >
        <path d="m9 12 2 2 4-4" />
        <circle cx="12" cy="12" r="10" />
      </svg>
      {text}
    </li>
  );
}
