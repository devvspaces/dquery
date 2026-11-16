import { ogCard, OG_SIZE } from "@/lib/og";

export const alt = "DQuery: find a domain name, then find who sells it cheapest";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    title: "Find a name. Then find who sells it cheapest.",
    subtitle: "Generate domain names and compare first-year, renewal and 3-year prices across registrars.",
    badge: "Free to try",
  });
}
