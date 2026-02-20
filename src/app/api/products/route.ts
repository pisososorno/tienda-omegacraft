import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      category: p.category,
      priceUsd: p.priceUsd.toString(),
      metadata: p.metadata,
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
