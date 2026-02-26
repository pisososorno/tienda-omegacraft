import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

const CATEGORY_SLUGS = ["maps", "plugins", "configurations", "source_code"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // ── Static pages ──
  entries.push(
    { url: APP_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${APP_URL}/catalog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${APP_URL}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  );

  // ── Category pages ──
  for (const cat of CATEGORY_SLUGS) {
    entries.push({
      url: `${APP_URL}/catalog?category=${cat}`,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // ── Product pages ──
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    for (const p of products) {
      entries.push({
        url: `${APP_URL}/catalog/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (err) {
    console.error("[sitemap] DB error:", err);
  }

  return entries;
}
