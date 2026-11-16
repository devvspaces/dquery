"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo";
import { useDomainQStore } from "@/lib/store/use-domainq-store";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/registrars", label: "Registrars" },
  { href: "/admin/prices", label: "Prices" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/ops", label: "Operations" },
];

/** Admin chrome plus the client-side gate (the API enforces access too). */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isInitialized, isAuthenticated } = useDomainQStore();

  if (!isInitialized || (isAuthenticated && !user)) {
    return <Centered>Loading…</Centered>;
  }
  if (!user?.isAdmin) {
    return (
      <Centered>
        <p className="text-base font-semibold text-foreground">Not authorised</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This area is for DQuery administrators.
        </p>
        <Link href="/" className="mt-4 text-sm text-primary hover:underline">
          Back to DQuery
        </Link>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="border-b border-border bg-card md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <LogoMark className="h-6 w-6" />
          <span className="text-sm font-semibold text-foreground">DQuery Admin</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-4" aria-label="Admin">
          {NAV.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-4 text-xs text-muted-foreground md:block">
          {user.email}
          <Link href="/" className="mt-2 block text-primary hover:underline">
            ← Back to site
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
