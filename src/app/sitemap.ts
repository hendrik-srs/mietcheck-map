import type { MetadataRoute } from "next";

import { BERLIN_BEZIRKE } from "@/lib/slugs";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://mietcheck-map.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const top: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/karte`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/check`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/quellen`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const bezirke: MetadataRoute.Sitemap = BERLIN_BEZIRKE.map(({ slug }) => ({
    url: `${SITE_URL}/bezirk/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...top, ...bezirke];
}
