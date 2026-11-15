"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDomainQStore } from "@/lib/store/use-domainq-store";

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
    </QueryClientProvider>
  );
}
