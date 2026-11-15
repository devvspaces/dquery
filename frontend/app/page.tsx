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
import { API_BASE_URL } from "@/lib/config";
import { GENERATION_COUNT, POPULAR_TLDS } from "@/lib/search-defaults";
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
          handleCheck(payload.domain);
        }
      } catch (err) {
        console.error("Failed to parse pending search:", err);
      }
    }
  }, [isInitialized, isAuthenticated]);

  // 2. Handle Domain Generation Flow (SSE Chaining)
  const handleGenerate = useCallback(
    async (data: { businessName: string; description: string; tlds: string[] }) => {
      // Force sign in if not authenticated
      if (!isAuthenticated) {
        localStorage.setItem(
          "pending_search",
          JSON.stringify({ type: "generate", payload: data })
        );
        setAuthOpen(true);
        return;
      }

      cleanupSse();
      setIsLoading(true);
      setHasSearched(true);
      setResults([]);
      setStreamStatusMessage("Submitting generation request...");

      try {
        const res = await fetch(`${BACKEND_URL}/api/domains/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            businessName: data.businessName,
            description: data.description,
            count: GENERATION_COUNT,
            style: "creative",
            tlds: data.tlds.map((t) => t.replace(/^\./, "")), // strip leading dot for API
          }),
        });

        if (!res.ok) {
          throw await apiError(res, "Failed to trigger domain generation");
        }

        const jobResponse = await res.json();
        const { jobId, sseUrl } = jobResponse;

        // Deduct upfront credit display instantly
        fetchProfile();

        // Establish the first SSE listener for LLM suggestions
        setStreamStatusMessage("Generating name ideas with AI...");
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
        const genSource = new EventSource(`${BACKEND_URL}${sseUrl}${tokenParam}`);
        genSseRef.current = genSource;

        genSource.addEventListener("job:active", () => {
          setStreamStatusMessage("AI is thinking and crafting domains...");
        });

        // When LLM suggestions finish
        genSource.addEventListener("job:completed", (event: any) => {
          try {
            const completedData = JSON.parse(event.data);
            const rawBasenames = completedData.result.domains; // e.g. ["swiftlaunch", "getswiftlaunch"]
            const targetTlds = data.tlds; // e.g. [".com", ".io"]

            // Pre-populate suggestions in UI instantly showing loading states next to each
            const prePopulated = mapBackendToFrontend([], rawBasenames, targetTlds);
            setResults(prePopulated);

            genSource.close();
            genSseRef.current = null;

            // Immediately chain the second SSE listener for aggregate checker batch progress
            setStreamStatusMessage("Suggestions loaded. Checking registrars in bulk...");
            const batchSource = new EventSource(
              `${BACKEND_URL}/api/domains/batch/${jobId}/stream${tokenParam}`
            );
            checkSseRef.current = batchSource;

            batchSource.addEventListener("batch:update", (batchEvent: any) => {
              try {
                const batchData = JSON.parse(batchEvent.data);
                const aggregatedResults = batchData.results || [];

                // Format and overlay checked values in UI dynamically
                const updatedResults = mapBackendToFrontend(
                  aggregatedResults,
                  rawBasenames,
                  targetTlds
                );
                setResults(updatedResults);

                // Update loader progress status message
                setStreamStatusMessage(
                  `Checking availabilities: ${batchData.completed}/${batchData.total} resolved (${batchData.progress}%)`
                );

                // Complete and close connections when all checks finish
                if (batchData.completed + batchData.failed >= batchData.total && batchData.total > 0) {
                  batchSource.close();
                  checkSseRef.current = null;
                  setIsLoading(false);
                  setStreamStatusMessage(null);
                  fetchProfile(); // update final credits
                  fetchSavedSearches(); // update history
                }
              } catch (err) {
                console.error("Error parsing batch check event:", err);
              }
            });

            batchSource.addEventListener("error", (err) => {
              console.error("Batch check SSE error:", err);
              batchSource.close();
              checkSseRef.current = null;
              setIsLoading(false);
              setStreamStatusMessage(null);
            });
          } catch (err) {
            console.error("Error parsing completion event:", err);
            genSource.close();
            genSseRef.current = null;
            setIsLoading(false);
            setStreamStatusMessage(null);
          }
        });

        genSource.addEventListener("job:failed", (event: any) => {
          const failedData = JSON.parse(event.data);
          console.error("Generation job failed:", failedData.error);
          genSource.close();
          genSseRef.current = null;
          setIsLoading(false);
          setStreamStatusMessage(null);
          fetchProfile(); // reload refunded credits
        });

        genSource.addEventListener("error", (err) => {
          console.error("Generation SSE stream error:", err);
          genSource.close();
          genSseRef.current = null;
          setIsLoading(false);
          setStreamStatusMessage(null);
        });
      } catch (err: any) {
        console.error("Generation failed:", err);
        if (err instanceof InsufficientCreditsError) {
          setHasSearched(false);
          setCreditsOpen(true);
        } else {
          alert(err.message || "Something went wrong starting domain generation");
        }
        setIsLoading(false);
        setStreamStatusMessage(null);
      }
    },
    [isAuthenticated, token, fetchProfile, fetchSavedSearches, setCreditsOpen]
  );

  // 3. Handle Domain Availability Checker Flow (Bulk Async SSE)
  const handleCheck = useCallback(
    async (domainInput: string) => {
      // Force sign in if not authenticated
      if (!isAuthenticated) {
        localStorage.setItem(
          "pending_search",
          JSON.stringify({ type: "check", payload: { domain: domainInput } })
        );
        setAuthOpen(true);
        return;
      }

      cleanupSse();
      setIsLoading(true);
      setHasSearched(true);
      setResults([]);
      setStreamStatusMessage("Starting domain checker...");

      try {
        const hasDot = domainInput.includes(".");
        let domainsToCheck: Array<{ domain: string; tld: string }> = [];
        let queryBasename = domainInput;
        let queryTlds = POPULAR_TLDS;

        if (hasDot) {
          const lastDot = domainInput.lastIndexOf(".");
          queryBasename = domainInput.substring(0, lastDot);
          const rawTld = domainInput.substring(lastDot + 1);
          domainsToCheck = [{ domain: queryBasename, tld: rawTld }];
          queryTlds = [`.${rawTld}`];
        } else {
          domainsToCheck = POPULAR_TLDS.map((t) => ({
            domain: queryBasename,
            tld: t.replace(/^\./, ""),
          }));
        }

        // Initialize UI with loaders immediately
        const prePopulated = mapBackendToFrontend([], [queryBasename], queryTlds);
        setResults(prePopulated);

        // Call the async bulk checker endpoint
        const res = await fetch(`${BACKEND_URL}/api/domains/check/bulk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ domains: domainsToCheck }),
        });

        if (!res.ok) {
          throw await apiError(res, "Failed to trigger domain checks");
        }

        const { batchId, sseUrl } = await res.json();

        // Refresh balance instantly after deduction
        fetchProfile();

        // Open SSE batch checker stream listener
        setStreamStatusMessage("Checking registrars in real-time...");
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
        const batchSource = new EventSource(`${BACKEND_URL}${sseUrl}${tokenParam}`);
        checkSseRef.current = batchSource;

        batchSource.addEventListener("batch:update", (event: any) => {
          try {
            const batchData = JSON.parse(event.data);
            const aggregatedResults = batchData.results || [];

            // Overlay checking results in real time
            const updatedResults = mapBackendToFrontend(
              aggregatedResults,
              [queryBasename],
              queryTlds
            );
            setResults(updatedResults);

            setStreamStatusMessage(
              `Progress: ${batchData.completed}/${batchData.total} resolved (${batchData.progress}%)`
            );

            // Complete checks
            if (batchData.completed + batchData.failed >= batchData.total && batchData.total > 0) {
              batchSource.close();
              checkSseRef.current = null;
              setIsLoading(false);
              setStreamStatusMessage(null);
              fetchProfile();
            }
          } catch (err) {
            console.error("Error parsing checker batch event:", err);
          }
        });

        batchSource.addEventListener("error", (err) => {
          console.error("Checker SSE stream error:", err);
          batchSource.close();
          checkSseRef.current = null;
          setIsLoading(false);
          setStreamStatusMessage(null);
        });
      } catch (err: any) {
        console.error("Domain check failed:", err);
        if (err instanceof InsufficientCreditsError) {
          setHasSearched(false);
          setCreditsOpen(true);
        } else {
          alert(err.message || "Failed to initiate domain check");
        }
        setIsLoading(false);
        setStreamStatusMessage(null);
      }
    },
    [isAuthenticated, token, fetchProfile, setCreditsOpen]
  );

  const handleTabChange = (tab: "generate" | "check") => {
    cleanupSse();
    setActiveTab(tab);
    setResults([]);
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
                  <TipItem text="Select fewer TLDs to focus on the best options" />
                  <TipItem text="Click any result to compare registrar prices" />
                </ul>
              ) : (
                <ul className="space-y-2.5">
                  <TipItem text="Enter a full domain like mybiz.com for a specific check" />
                  <TipItem text="Enter just a name to check across all popular TLDs" />
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
