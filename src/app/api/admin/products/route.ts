import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        _count: { select: { orders: true, files: true } },
      },
    });

    return jsonOk(
      products.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        category: p.category,
        priceUsd: p.priceUsd.toString(),
        isActive: p.isActive,
        downloadLimit: p.downloadLimit,
        downloadExpiresDays: p.downloadExpiresDays,
        createdAt: p.createdAt.toISOString(),
        orderCount: p._count.orders,
        fileCount: p._count.files,
        thumbnail: p.images[0]?.storageKey || null,
      }))
    );
  } catch (error) {
    console.error("[api/admin/products]", error);
    return jsonError("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = await req.json();
    const { name, slug, shortDescription, description, category, priceUsd, metadata, videoUrl, downloadLimit, downloadExpiresDays, isActive } = body;

    if (!name || !slug || !description || !category || priceUsd == null) {
      return jsonError("Missing required fields: name, slug, description, category, priceUsd");
    }

    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      return jsonError("A product with this slug already exists", 409);
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        shortDescription: shortDescription || null,
        description,
        category,
        priceUsd: parseFloat(priceUsd),
        metadata: metadata || {},
        videoUrl: videoUrl || null,
        downloadLimit: downloadLimit || 3,
        downloadExpiresDays: downloadExpiresDays || 7,
        isActive: isActive !== false,
      },
    });

    return jsonOk(
      { id: product.id, slug: product.slug, name: product.name },
      201
    );
  } catch (error) {
    console.error("[api/admin/products POST]", error);
    return jsonError("Internal server error", 500);
  }
}
