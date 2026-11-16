"use client";

import Link from "next/link";
import { CircleCheck, Coins, History, Sparkles } from "lucide-react";
import { formatCredits } from "@/lib/pricing";
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
  onOpenHistory?: () => void;
}

const TABS = [
  { id: "generate", label: "Generate", Icon: Sparkles },
  { id: "check", label: "Check", Icon: CircleCheck },
] as const;

export function Header({ activeTab, onTabChange, onSignIn, onBuyCredits, onOpenAccount, onOpenHistory }: HeaderProps) {
  const user = useDomainQStore((s) => s.user);
  const isAuthenticated = useDomainQStore((s) => s.isAuthenticated);
  const initials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="DQuery home">
            <LogoMark />
            <span className="hidden text-base font-semibold tracking-tight text-foreground sm:inline">DQuery</span>
          </Link>

          <nav aria-label="Mode">
            <div className="flex rounded-lg bg-muted p-0.5" role="tablist">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => onTabChange(id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all sm:px-3",
                    activeTab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {isAuthenticated && user ? (
            <>
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="hidden items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground md:inline-flex"
                >
                  Admin
                </Link>
              )}
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:px-3"
                  aria-label="History"
                >
                  <History className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">History</span>
                </button>
              )}
              <button
                type="button"
                onClick={onBuyCredits}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-all hover:bg-muted/80 sm:px-3"
                aria-label={`${formatCredits(user.credits)} credits. Buy more`}
              >
                <Coins className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="font-semibold tabular-nums">{formatCredits(user.credits)}</span>
                <span className="hidden text-muted-foreground sm:inline">credits</span>
              </button>
              <span className="hidden sm:inline-flex">
                <ThemeToggle />
              </span>
              <button
                type="button"
                onClick={onOpenAccount}
                aria-label="Account"
                className="flex items-center rounded-full p-0.5 transition-all hover:ring-2 hover:ring-primary/20"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
