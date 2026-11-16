import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { POPULAR_TLD_ORDER } from "@/lib/public-api";

/** Footer with links to the top extension price pages (internal linking for SEO). */
export function SiteFooter({ tlds }: { tlds?: string[] }) {
  const priced = new Set(tlds ?? POPULAR_TLD_ORDER);
  const links = POPULAR_TLD_ORDER.filter((t) => priced.has(t)).slice(0, 20);

  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.2fr_2fr_1fr]">
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="font-semibold text-foreground">DQuery</span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">
            Find a domain name, then find who sells it cheapest, renewals included.
          </p>
        </div>
        <nav aria-label="Prices by extension">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prices by extension</h2>
          <ul className="grid grid-cols-3 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            {links.map((t) => (
              <li key={t}>
                <Link href={`/tld/${t}`} className="font-mono text-sm text-muted-foreground hover:text-primary">
                  .{t}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/tld" className="text-sm text-primary hover:underline">
                All →
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Product">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</h2>
          <ul className="space-y-1.5 text-sm">
            <li><Link href="/search" className="text-muted-foreground hover:text-foreground">Name generator</Link></li>
            <li><Link href="/search?tab=check" className="text-muted-foreground hover:text-foreground">Domain price checker</Link></li>
            <li><Link href="/tld" className="text-muted-foreground hover:text-foreground">Extension prices</Link></li>
            <li><Link href="/legal/credits" className="text-muted-foreground hover:text-foreground">Credits &amp; disclosure</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} DQuery. Some Buy links are affiliate links.</p>
          <p>
            <a href="https://www.exchangerate-api.com" rel="noopener" target="_blank" className="hover:text-foreground">
              Rates By Exchange Rate API
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
