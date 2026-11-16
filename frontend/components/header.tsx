"use client";

import { formatCredits } from "@/lib/pricing";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { LogoMark } from "@/components/logo";

interface HeaderProps {
  activeTab: "generate" | "check";
  onTabChange: (tab: "generate" | "check") => void;
  onSignIn: () => void;
  onBuyCredits: () => void;
  onOpenAccount: () => void;
}

export function Header({
  activeTab,
  onTabChange,
  onSignIn,
  onBuyCredits,
  onOpenAccount,
}: HeaderProps) {
  const { user, isAuthenticated } = useDomainQStore();

  const initials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" aria-label="DQuery home">
            <LogoMark />
            <span className="text-base font-semibold tracking-tight text-foreground">
              DQuery
            </span>
          </Link>

          <nav className="flex items-center">
            <div className="flex rounded-lg bg-muted p-0.5">
              <button
                onClick={() => onTabChange("generate")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  activeTab === "generate"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
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
                Generate
              </button>
              <button
                onClick={() => onTabChange("check")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  activeTab === "check"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
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
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                Check
              </button>
            </div>
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <>
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="hidden sm:inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Admin
                </Link>
              )}
              {/* Credits pill */}
              <button
                onClick={onBuyCredits}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-all"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v12" />
                  <path d="M15.5 9.4a4 4 0 0 0-7 0" />
                  <path d="M8.5 14.6a4 4 0 0 0 7 0" />
                </svg>
                <span className="font-semibold">{formatCredits(user.credits)}</span>
                <span className="text-muted-foreground">credits</span>
              </button>

              <ThemeToggle />

              {/* Avatar */}
              <button
                onClick={onOpenAccount}
                className="flex items-center gap-2 rounded-full p-0.5 transition-all hover:ring-2 hover:ring-primary/20"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
