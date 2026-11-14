"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDomainQStore } from "@/lib/store/use-domainq-store";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setToken = useDomainQStore((state) => state.setToken);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setToken(token);
    }
    router.replace("/");
  }, [searchParams, setToken, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse_dot" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse_dot" style={{ animationDelay: "0.2s" }} />
          <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse_dot" style={{ animationDelay: "0.4s" }} />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Completing sign in...
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading auth handshake...
          </p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
