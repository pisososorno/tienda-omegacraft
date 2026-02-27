import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ALL, scopeProductsWhere, isSeller, canSellCategory, logAudit } from "@/lib/rbac";
import type { ProductCategory } from "@prisma/client";

export async function GET(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  try {
    const products = await prisma.product.findMany({
      where: scopeProductsWhere(auth),
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
        minecraftVersionMin: p.minecraftVersionMin,
        minecraftVersionMax: p.minecraftVersionMax,
        supportedVersions: p.supportedVersions,
        platforms: p.platforms,
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
  const auth = await withAdminAuth(req, { roles: ROLES_ALL, requireActiveSeller: true });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const {
      name, slug, shortDescription, description, category, priceUsd, metadata, videoUrl,
      downloadLimit, downloadExpiresDays, isActive,
      minecraftVersionMin, minecraftVersionMax, supportedVersions, platforms,
    } = body;

    if (!name || !slug || !description || !category || priceUsd == null) {
      return jsonError("Missing required fields: name, slug, description, category, priceUsd");
    }

    // SELLER: validate category permission
    if (isSeller(auth) && !canSellCategory(auth, category as ProductCategory)) {
      await logAudit(req, auth.userId, "seller_category_denied", { category, productSlug: slug });
      return jsonError("No tienes permiso para vender en la categoría: " + category, 403);
    }

    // SELLER in pending: can only create as draft (isActive=false)
    const effectiveIsActive = isSeller(auth) && auth.sellerStatus === "pending"
      ? false
      : isActive !== false;

    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      return jsonError("A product with this slug already exists", 409);
    }

    // SELLER: auto-assign sellerId. ADMIN: sellerId=null (official store product)
    const sellerId = isSeller(auth) ? auth.sellerId : null;

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
        isActive: effectiveIsActive,
        sellerId,
        minecraftVersionMin: minecraftVersionMin || null,
        minecraftVersionMax: minecraftVersionMax || null,
        supportedVersions: supportedVersions || [],
        platforms: platforms || [],
      },
    });

    await logAudit(req, auth.userId, "product_created", { productId: product.id, slug, category, sellerId });

    return jsonOk(
      { id: product.id, slug: product.slug, name: product.name },
      201
    );
  } catch (error) {
    console.error("[api/admin/products POST]", error);
    return jsonError("Internal server error", 500);
  }
}
