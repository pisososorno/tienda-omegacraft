import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

/**
 * Compare two Minecraft version strings (e.g. "1.20.4" vs "1.16").
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
function compareMcVersion(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const version = searchParams.get("version");
    const platform = searchParams.get("platform");

    // Build Prisma where clause
    const where: Prisma.ProductWhereInput = { isActive: true };

    // Platform filter: product.platforms array contains the value
    if (platform) {
      where.platforms = { has: platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase() };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Version filter: done in-app because Prisma doesn't support array-contains + range in one query
    const filtered = version
      ? products.filter((p) => {
          // If supportedVersions has entries, check if version is in the list
          if (p.supportedVersions.length > 0) {
            return p.supportedVersions.some((v) => v === version || v.startsWith(version + ".") || version.startsWith(v + "."));
          }
          // Fallback to min/max range
          if (p.minecraftVersionMin && p.minecraftVersionMax) {
            return compareMcVersion(version, p.minecraftVersionMin) >= 0
              && compareMcVersion(version, p.minecraftVersionMax) <= 0;
          }
          // Single version: min === max
          if (p.minecraftVersionMin) {
            return p.minecraftVersionMin === version;
          }
          // No version data: include by default (don't penalize products without version info)
          return true;
        })
      : products;

    const result = filtered.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      category: p.category,
      priceUsd: p.priceUsd.toString(),
      metadata: p.metadata,
      minecraftVersionMin: p.minecraftVersionMin,
      minecraftVersionMax: p.minecraftVersionMax,
      supportedVersions: p.supportedVersions,
      platforms: p.platforms,
      coverImage: p.images[0]?.storageKey
        ? p.images[0].storageKey.startsWith("/") || p.images[0].storageKey.startsWith("http")
          ? p.images[0].storageKey
          : `/${p.images[0].storageKey}`
        : null,
    }));

    return jsonOk(result);
  } catch (error) {
    console.error("[api/products]", error);
    return jsonError("Internal server error", 500);
  }
}
