import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search domain names and compare prices",
  description:
    "Generate brandable domain names with AI or the word builder, then check availability and compare first-year, renewal and 3-year prices across 12 registrars.",
  alternates: { canonical: "/search" },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
