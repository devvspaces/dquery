"use client";

import { formatCredits } from "@/lib/pricing";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { API_BASE_URL } from "@/lib/config";

interface AccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuyCredits: () => void;
}

type AccountTab = "bookmarks" | "searches" | "purchases";

export function AccountSheet({ open, onOpenChange, onBuyCredits }: AccountSheetProps) {
  const {
    user,
    logout,
    bookmarks,
    savedSearches,
    toggleBookmark,
    token,
  } = useDomainQStore();

  const [activeTab, setActiveTab] = useState<AccountTab>("bookmarks");

  // Query transaction history via TanStack Query
  const { data: purchases = [], isLoading: isLoadingPurchases } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch(`${API_BASE_URL}/api/credits/transactions?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!token && open && activeTab === "purchases",
  });

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const formatDate = (dateString: string | Date) => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const exportBookmarksCSV = () => {
    const header = "Domain,Extension,Saved At\n";
    const rows = bookmarks
      .map((b) => [b.domain, b.extension, new Date(b.createdAt).toISOString()].join(","))
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dquery-bookmarks.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Profile header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold text-foreground truncate">
                {user.name}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground truncate">
                {user.email}
              </SheetDescription>
            </div>
          </div>

          {/* Credits bar */}
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 border border-border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v12" />
                  <path d="M15.5 9.4a4 4 0 0 0-7 0" />
                  <path d="M8.5 14.6a4 4 0 0 0 7 0" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credits</p>
                <p className="text-sm font-bold text-foreground">{formatCredits(user.credits)}</p>
              </div>
            </div>
            <button
              onClick={() => {
                onOpenChange(false);
                setTimeout(onBuyCredits, 200);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Buy credits
            </button>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {(
            [
              { id: "bookmarks" as const, label: "Bookmarks", count: bookmarks.length },
              { id: "searches" as const, label: "Searches", count: savedSearches.length },
              { id: "purchases" as const, label: "Transactions", count: purchases.length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-all",
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                  activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "bookmarks" && (
            <div className="p-4">
              {bookmarks.length > 0 && (
                <div className="flex items-center justify-end mb-3">
                  <button
                    onClick={exportBookmarksCSV}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" x2="12" y1="15" y2="3" />
                    </svg>
                    Export CSV
                  </button>
                </div>
              )}
              {bookmarks.length === 0 ? (
                <EmptyTab
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                    </svg>
                  }
                  title="No bookmarks yet"
                  description="Save domains from your search results to find them here later."
                />
              ) : (
                <div className="space-y-1.5">
                  {bookmarks.map((b) => {
                    // Extract name from the full domain string
                    const lastDot = b.domain.lastIndexOf(".");
                    const name = lastDot !== -1 ? b.domain.substring(0, lastDot) : b.domain;
                    const extension = lastDot !== -1 ? b.domain.substring(lastDot) : b.extension;
                    
                    let parsedPrice: number | null = null;
                    if (b.pricesSnapshot) {
                      try {
                        const prices = JSON.parse(b.pricesSnapshot);
                        if (Array.isArray(prices)) {
                          const availablePrices = prices
                            .filter((p: any) => p.available && p.registerPrice !== null)
                            .map((p: any) => p.registerPrice);
                          if (availablePrices.length > 0) {
                            parsedPrice = Math.min(...availablePrices);
                          }
                        } else if (prices && typeof prices === "object" && prices.price) {
                          parsedPrice = parseFloat(prices.price);
                        }
                      } catch (_) {}
                    }

                    return (
                      <div
                        key={b.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition-all hover:bg-muted/30 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-success" />
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-0.5">
                              <span className="font-mono text-sm font-medium text-foreground truncate">{name}</span>
                              <span className="font-mono text-sm text-primary">{extension}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{formatDate(b.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {parsedPrice !== null && (
                            <span className="text-xs font-medium text-foreground">
                              ${parsedPrice.toFixed(2)}
                              <span className="text-muted-foreground">/yr</span>
                            </span>
                          )}
                          <button
                            onClick={() => toggleBookmark(b.domain, b.extension)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                            aria-label={`Remove bookmark for ${b.domain}`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                              <path d="M18 6 6 18" />
                              <path d="m6 6 12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "searches" && (
            <div className="p-4">
              {savedSearches.length === 0 ? (
                <EmptyTab
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  }
                  title="No saved searches"
                  description="Your search history will appear here."
                />
              ) : (
                <div className="space-y-1.5">
                  {savedSearches.map((s) => {
                    let tldsList: string[] = [];
                    try {
                      tldsList = JSON.parse(s.tlds);
                    } catch (_) {}

                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition-all hover:bg-muted/30 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md shrink-0 bg-primary/10 text-primary">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{s.businessName}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">{s.resultsCount} suggestions</span>
                              {tldsList.length > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  TLDs: {tldsList.join(", ")}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground">{formatDate(s.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "purchases" && (
            <div className="p-4">
              {isLoadingPurchases ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
                  <p className="text-xs text-muted-foreground">Loading transactions...</p>
                </div>
              ) : purchases.length === 0 ? (
                <EmptyTab
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" x2="22" y1="10" y2="10" />
                    </svg>
                  }
                  title="No transactions yet"
                  description="Your transaction history will appear here."
                />
              ) : (
                <div className="space-y-1.5">
                  {purchases.map((p: any) => {
                    const isRefund = p.type === "refund";
                    const isDeduction = p.type === "deduction";
                    const isPurchase = p.type === "purchase" || p.type === "bonus";

                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
                              isRefund ? "bg-success/10 text-success" : isDeduction ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                            )}
                          >
                            {isRefund ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m15 18-6-6 6-6" />
                              </svg>
                            ) : isDeduction ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" />
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate capitalize">{p.type} transaction</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={p.description}>
                              {p.description} &middot; {formatDate(p.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-sm font-bold",
                            isRefund || isPurchase ? "text-success" : "text-destructive"
                          )}>
                            {isRefund || isPurchase ? "+" : "-"}{Math.abs(parseFloat(p.amount))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-3">
          <button
            onClick={() => {
              logout();
              onOpenChange(false);
            }}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyTab({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground max-w-[220px]">{description}</p>
    </div>
  );
}
