import type { MetadataRoute } from "next";
import { getCatalog, MIN_INDEXABLE_REGISTRARS } from "@/lib/public-api";
import { SITE_URL } from "@/lib/site";

export const revalidate = 21600;

/** Landing, the tool, and every extension page with enough prices to be useful. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalog();
  const now = new Date();
  const tldPages: MetadataRoute.Sitemap = (catalog?.tlds ?? [])
    .filter((t) => t.registrars >= MIN_INDEXABLE_REGISTRARS)
    .map((t) => ({
      url: `${SITE_URL}/tld/${t.tld}`,
      lastModified: new Date(t.updatedAt),
      changeFrequency: "daily",
      priority: 0.6,
    }));
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/tld`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...tldPages,
    { url: `${SITE_URL}/legal/credits`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
