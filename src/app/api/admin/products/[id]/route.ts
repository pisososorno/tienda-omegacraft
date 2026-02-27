import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ALL, verifyProductOwnership, isSeller, canSellCategory, logAudit } from "@/lib/rbac";
import type { ProductCategory } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  // SELLER: verify ownership
  if (isSeller(auth)) {
    const owns = await verifyProductOwnership(auth, id);
    if (!owns) return jsonError("Product not found", 404);
  }

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
      minecraftVersionMin: product.minecraftVersionMin,
      minecraftVersionMax: product.minecraftVersionMax,
      supportedVersions: product.supportedVersions,
      platforms: product.platforms,
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
  const auth = await withAdminAuth(req, { roles: ROLES_ALL, requireActiveSeller: true });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const {
      name, slug, shortDescription, description, category,
      priceUsd, metadata, videoUrl, downloadLimit, downloadExpiresDays, isActive,
      minecraftVersionMin, minecraftVersionMax, supportedVersions, platforms,
    } = body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return jsonError("Product not found", 404);

    // SELLER: can only edit own products, never sellerId=null
    if (isSeller(auth)) {
      if (existing.sellerId !== auth.sellerId) return jsonError("Product not found", 404);
    }

    // SELLER: validate category if changing
    if (isSeller(auth) && category !== undefined && !canSellCategory(auth, category as ProductCategory)) {
      await logAudit(req, auth.userId, "seller_category_denied", { category, productId: id });
      return jsonError("No tienes permiso para esa categor\u00eda: " + category, 403);
    }

    // SELLER in pending: cannot publish (force isActive=false)
    const effectiveIsActive = isSeller(auth) && auth.sellerStatus === "pending"
      ? false
      : isActive;

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
        ...(effectiveIsActive !== undefined && { isActive: effectiveIsActive }),
        ...(minecraftVersionMin !== undefined && { minecraftVersionMin: minecraftVersionMin || null }),
        ...(minecraftVersionMax !== undefined && { minecraftVersionMax: minecraftVersionMax || null }),
        ...(supportedVersions !== undefined && { supportedVersions: supportedVersions || [] }),
        ...(platforms !== undefined && { platforms: platforms || [] }),
      },
    });

    await logAudit(req, auth.userId, "product_updated", { productId: id, fields: Object.keys(body) });

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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ALL, requireActiveSeller: true });
  if (isAuthError(auth)) return auth;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!product) return jsonError("Product not found", 404);

    // SELLER: can only delete own products
    if (isSeller(auth)) {
      if (product.sellerId !== auth.sellerId) return jsonError("Product not found", 404);
    }

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

    await logAudit(req, auth.userId, "product_deleted", { productId: id, slug: product.slug });

    return jsonOk({ action: "deleted" });
  } catch (error) {
    console.error("[api/admin/products/id DELETE]", error);
    return jsonError("Internal server error", 500);
  }
}
