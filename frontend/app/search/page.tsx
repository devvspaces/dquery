"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import { Header } from "@/components/header";
import { GeneratorForm } from "@/components/generator-form";
import { CheckerForm } from "@/components/checker-form";
import { EmptyStateCheck, EmptyStateGenerate } from "@/components/empty-state";
import { AuthDialog } from "@/components/auth-dialog";
import { CreditsDialog } from "@/components/credits-dialog";
import { AccountSheet } from "@/components/account-sheet";
import { NameReview } from "@/components/name-review";
import { ResultsWorkspace } from "@/components/results/results-workspace";
import { HistoryList, HistorySheet } from "@/components/history-panel";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { useSearchSession } from "@/lib/hooks/use-search-session";
import { buildCheckPairs } from "@/lib/search-defaults";
import { DEFAULT_SELECTED } from "@/components/tld-selector";
import { useUrlTab, type Tab } from "@/lib/url-tab";
import type { GenerateRequest } from "@/lib/types";

export default function Page() {
  const isAuthenticated = useDomainQStore((s) => s.isAuthenticated);
  const isInitialized = useDomainQStore((s) => s.isInitialized);
  const authOpen = useDomainQStore((s) => s.authOpen);
  const setAuthOpen = useDomainQStore((s) => s.setAuthOpen);
  const creditsOpen = useDomainQStore((s) => s.creditsOpen);
  const setCreditsOpen = useDomainQStore((s) => s.setCreditsOpen);
  const accountOpen = useDomainQStore((s) => s.accountOpen);
  const setAccountOpen = useDomainQStore((s) => s.setAccountOpen);
  const [historyOpen, setHistoryOpen] = useState(false);

  const session = useSearchSession({ onInsufficientCredits: () => setCreditsOpen(true) });
  const { phase, meta, rows, review, progress } = session;

  /** Form prefill: `?q=` from the landing page, or the current search when editing. */
  const [prefill, setPrefill] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [activeTab, setActiveTab] = useUrlTab(() => session.reset());

  // Landing-page prefill and saved-search deep links (?s=) on first load.
  const pendingOpen = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPrefill((params.get("q") ?? "").slice(0, 500));
    setFormKey((k) => k + 1);
    pendingOpen.current = params.get("s");
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const id = pendingOpen.current;
    if (id) {
      pendingOpen.current = null;
      if (isAuthenticated) void session.load(id);
      else setAuthOpen(true);
      return;
    }
    if (!isAuthenticated) return;
    // A search started before signing in.
    const pending = localStorage.getItem("pending_search");
    if (!pending) return;
    localStorage.removeItem("pending_search");
    try {
      const { type, payload } = JSON.parse(pending);
      if (type === "generate") {
        setActiveTab("generate");
        void session.generate(payload);
      } else if (type === "check") {
        setActiveTab("check");
        const pairs = buildCheckPairs(payload.domain, payload.tlds ?? DEFAULT_SELECTED);
        void session.check(pairs, { fresh: true, title: payload.domain });
      }
    } catch (err) {
      console.error("Bad pending search", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isAuthenticated]);

  // New screen: start at the top (matters on phones, where results were below the form).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase]);

  const requireAuth = (save: () => void) => {
    if (isAuthenticated) return true;
    save();
    setAuthOpen(true);
    return false;
  };

  const handleGenerate = useCallback(
    (data: GenerateRequest) => {
      if (!requireAuth(() => localStorage.setItem("pending_search", JSON.stringify({ type: "generate", payload: data }))))
        return;
      void session.generate(data);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated, session.generate]
  );

  const handleCheck = useCallback(
    (query: string, tlds: string[]) => {
      if (
        !requireAuth(() =>
          localStorage.setItem("pending_search", JSON.stringify({ type: "check", payload: { domain: query, tlds } }))
        )
      )
        return;
      const pairs = buildCheckPairs(query, tlds);
      if (pairs.length) void session.check(pairs, { fresh: true, title: query });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated, session.check]
  );

  const handleTabChange = (tab: Tab) => {
    if (tab === activeTab && phase === "idle") return;
    session.reset();
    setActiveTab(tab);
  };

  const openSearch = (id: string) => void session.load(id);

  const editSearch = () => {
    if (!meta) return;
    setPrefill(meta.kind === "generate" ? meta.description || meta.title : meta.title);
    setFormKey((k) => k + 1);
    setActiveTab(meta.kind === "generate" ? "generate" : "check");
    session.setPhase("idle");
  };

  const newSearch = () => {
    setPrefill("");
    setFormKey((k) => k + 1);
    session.reset();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSignIn={() => setAuthOpen(true)}
        onBuyCredits={() => setCreditsOpen(true)}
        onOpenAccount={() => setAccountOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      <main className="mx-auto max-w-6xl px-4 pb-20">
        {phase === "idle" && (
          <div className="grid gap-8 py-8 lg:grid-cols-[420px_1fr]">
            <section aria-labelledby="form-title" className="space-y-4">
              <div>
                <h1 id="form-title" className="text-xl font-semibold tracking-tight text-foreground">
                  {activeTab === "generate" ? "Find a name" : "Check a domain"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeTab === "generate"
                    ? "Describe your idea or build from your own words. You'll pick the names to check next."
                    : "Type a name or a domain and pick the extensions to compare."}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                {activeTab === "generate" ? (
                  <GeneratorForm
                    key={`g-${formKey}`}
                    onGenerate={handleGenerate}
                    isLoading={progress.running}
                    initialDescription={prefill}
                  />
                ) : (
                  <CheckerForm
                    key={`c-${formKey}`}
                    onCheck={handleCheck}
                    isLoading={progress.running}
                    initialDomain={prefill}
                  />
                )}
              </div>
              {meta && (
                <button
                  type="button"
                  onClick={() => session.setPhase(rows.length ? "results" : "review")}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to &ldquo;{meta.title}&rdquo;
                </button>
              )}
            </section>

            <section aria-label="Recent searches" className="min-w-0">
              {isAuthenticated ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <History className="h-4 w-4 text-muted-foreground" aria-hidden /> Recent searches
                    </h2>
                    <button type="button" onClick={() => setHistoryOpen(true)} className="text-xs text-primary hover:underline">
                      View all
                    </button>
                  </div>
                  <HistoryList onOpen={openSearch} limit={6} searchable={false} />
                  <p className="mt-4 text-xs text-muted-foreground">
                    Every search is saved with its results. Reopening one is free; refresh prices or re-check whenever you
                    like.
                  </p>
                </div>
              ) : activeTab === "generate" ? (
                <EmptyStateGenerate />
              ) : (
                <EmptyStateCheck />
              )}
            </section>
          </div>
        )}

        {phase === "generating" && (
          <div className="mx-auto max-w-2xl py-16 text-center" aria-live="polite">
            <div className="mx-auto mb-6 flex max-w-md flex-wrap justify-center gap-2" aria-hidden>
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="h-8 animate-pulse rounded-lg bg-muted"
                  style={{ width: `${60 + ((i * 37) % 70)}px`, animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
            <p className="text-base font-medium text-foreground">{progress.message ?? "Working…"}</p>
            <p className="mt-1 text-sm text-muted-foreground">This usually takes a few seconds.</p>
          </div>
        )}

        {phase === "review" && review && (
          <div className="py-6">
            <NameReview
              key={review.names.join(",")}
              review={review}
              isLoading={progress.running}
              backLabel={rows.length ? "Back to results" : "Back"}
              onBack={() => (rows.length ? session.setPhase("results") : editSearch())}
              onCheck={(pairs, techniques) => void session.check(pairs, { techniques })}
            />
          </div>
        )}

        {phase === "results" && meta && (
          <ResultsWorkspace
            meta={meta}
            rows={rows}
            progress={progress}
            onEdit={editSearch}
            onNew={newSearch}
            onMoreNames={() => void session.moreNames()}
            onBackToNames={session.backToNames}
            onRefreshPrices={(pairs) => void session.refreshPrices(pairs)}
            onRecheck={(pairs) => void session.recheck(pairs)}
          />
        )}

        {phase === "results" && !meta && progress.running && (
          <p className="py-16 text-center text-sm text-muted-foreground" aria-live="polite">
            {progress.message}
          </p>
        )}
      </main>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <CreditsDialog open={creditsOpen} onOpenChange={setCreditsOpen} />
      <AccountSheet
        open={accountOpen}
        onOpenChange={setAccountOpen}
        onBuyCredits={() => setCreditsOpen(true)}
        onOpenSearch={openSearch}
      />
      <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} onOpen={openSearch} />
    </div>
  );
}
