"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";
import { AuthDialog } from "@/components/auth-dialog";
import { useDomainQStore } from "@/lib/store/use-domainq-store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/tld", label: "Prices by extension" },
  { href: "/#pricing", label: "Pricing" },
];

/**
 * Marketing header: three links and one CTA. Signed-in visitors get
 * "Open app" (the token lives in localStorage, so this is a client island).
 */
export function SiteHeader() {
  const { isAuthenticated, isInitialized, authOpen, setAuthOpen } = useDomainQStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors",
        scrolled ? "border-b border-border bg-background/80 backdrop-blur-xl" : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="DQuery home">
          <LogoMark />
          <span className="text-base font-semibold tracking-tight text-foreground">DQuery</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {isInitialized && isAuthenticated ? (
            <Link
              href="/search"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open app
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
              >
                Sign in
              </button>
              <Link
                href="/search"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Try it free
              </Link>
            </>
          )}
        </div>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </header>
  );
}
