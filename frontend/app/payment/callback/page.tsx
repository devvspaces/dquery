"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/config";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { LogoMark } from "@/components/logo";

type State =
  | { kind: "checking" }
  | { kind: "completed"; credits: number }
  | { kind: "failed" }
  | { kind: "timeout" }
  | { kind: "error"; message: string };

const POLL_MS = 2000;
const MAX_POLLS = 30; // ~1 minute; webhooks normally land within seconds

function PaymentStatus() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref");
  const { token, isInitialized, fetchProfile } = useDomainQStore();
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    if (!isInitialized) return;
    if (!reference || !token) {
      setState({ kind: "error", message: "Missing payment reference or not signed in." });
      return;
    }
    let polls = 0;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      polls += 1;
      try {
        const res = await fetch(`${API_BASE_URL}/api/payments/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || "Couldn't check the payment.");
        if (body.status === "completed") {
          setState({ kind: "completed", credits: body.credits });
          fetchProfile();
          return;
        }
        if (body.status === "failed") return setState({ kind: "failed" });
        if (polls >= MAX_POLLS) return setState({ kind: "timeout" });
        setTimeout(poll, POLL_MS);
      } catch (err) {
        setState({ kind: "error", message: err instanceof Error ? err.message : "Unknown error" });
      }
    };
    poll();
    return () => {
      stopped = true;
    };
  }, [reference, token, isInitialized, fetchProfile]);

  const copy: Record<State["kind"], { title: string; body: string }> = {
    checking: { title: "Confirming your payment…", body: "This usually takes a few seconds." },
    completed: {
      title: "Payment successful",
      body: state.kind === "completed" ? `${state.credits} credits were added to your account.` : "",
    },
    failed: {
      title: "Payment not completed",
      body: "No credits were added and you weren't charged for credits. You can try again.",
    },
    timeout: {
      title: "Still processing",
      body: "Your bank is taking longer than usual. Credits will appear automatically once it clears.",
    },
    error: { title: "Something went wrong", body: state.kind === "error" ? state.message : "" },
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        <LogoMark className="mx-auto mb-4 h-10 w-10" />
        <h1 className="text-lg font-semibold text-foreground">{copy[state.kind].title}</h1>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="payment-status">
          {copy[state.kind].body}
        </p>
        {state.kind !== "checking" && (
          <Link
            href="/"
            className="mt-5 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to DQuery
          </Link>
        )}
      </div>
    </main>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={null}>
      <PaymentStatus />
    </Suspense>
  );
}
