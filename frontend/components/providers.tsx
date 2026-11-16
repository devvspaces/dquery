"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { Toaster } from "@/components/ui/sonner";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })
  );

  const initializeAuth = useDomainQStore((state) => state.initializeAuth);
  const fetchPricing = useDomainQStore((state) => state.fetchPricing);

  useEffect(() => {
    initializeAuth();
    fetchPricing();
  }, [initializeAuth, fetchPricing]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-center" richColors closeButton />
    </QueryClientProvider>
  );
}
