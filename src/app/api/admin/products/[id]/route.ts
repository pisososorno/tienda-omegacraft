import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        files: { orderBy: { sortOrder: "asc" } },
        _count: { select: { orders: true } },
      },
    });

    if (!product) return jsonError("Product not found", 404);

    return jsonOk({
      id: product.id,
      slug: product.slug,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      category: product.category,
      priceUsd: product.priceUsd.toString(),
      isActive: product.isActive,
      metadata: product.metadata,
      videoUrl: product.videoUrl,
      downloadLimit: product.downloadLimit,
      downloadExpiresDays: product.downloadExpiresDays,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      orderCount: product._count.orders,
      images: product.images,
      files: product.files.map((f) => ({
        ...f,
        fileSize: f.fileSize.toString(),
      })),
    });
  } catch (error) {
    console.error("[api/admin/products/id GET]", error);
    return jsonError("Internal server error", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = await req.json();
    const {
      name, slug, shortDescription, description, category,
      priceUsd, metadata, videoUrl, downloadLimit, downloadExpiresDays, isActive,
    } = body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return jsonError("Product not found", 404);

    if (slug && slug !== existing.slug) {
      const slugTaken = await prisma.product.findUnique({ where: { slug } });
      if (slugTaken) return jsonError("Slug already in use", 409);
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(shortDescription !== undefined && { shortDescription }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(priceUsd !== undefined && { priceUsd: parseFloat(priceUsd) }),
        ...(metadata !== undefined && { metadata }),
        ...(videoUrl !== undefined && { videoUrl }),
        ...(downloadLimit !== undefined && { downloadLimit }),
        ...(downloadExpiresDays !== undefined && { downloadExpiresDays }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return jsonOk({
      id: product.id,
      slug: product.slug,
      name: product.name,
    });
  } catch (error) {
    console.error("[api/admin/products/id PUT]", error);
    return jsonError("Internal server error", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!product) return jsonError("Product not found", 404);

    if (product._count.orders > 0) {
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return jsonOk({ action: "deactivated", reason: "Product has existing orders" });
    }

    await prisma.productImage.deleteMany({ where: { productId: id } });
    await prisma.productFile.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    return jsonOk({ action: "deleted" });
  } catch (error) {
    console.error("[api/admin/products/id DELETE]", error);
    return jsonError("Internal server error", 500);
  }
}
