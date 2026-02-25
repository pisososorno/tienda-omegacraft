import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ALL, verifyProductOwnership, isSeller } from "@/lib/rbac";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ALL, requireActiveSeller: true });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const { url, altText, isPrimary } = body;

    if (!url) return jsonError("Missing image URL");

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return jsonError("Product not found", 404);
    if (isSeller(auth) && product.sellerId !== auth.sellerId) return jsonError("Product not found", 404);

    // If setting as primary, unset current primary
    if (isPrimary) {
      await prisma.productImage.updateMany({
        where: { productId: id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Get max sort order
    const maxSort = await prisma.productImage.findFirst({
      where: { productId: id },
      orderBy: { sortOrder: "desc" },
    });

    const image = await prisma.productImage.create({
      data: {
        productId: id,
        storageKey: url,
        altText: altText || product.name,
        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
        isPrimary: isPrimary || false,
      },
    });

    return jsonOk(image, 201);
  } catch (error) {
    console.error("[api/admin/products/id/images POST]", error);
    return jsonError("Internal server error", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ALL, requireActiveSeller: true });
  if (isAuthError(auth)) return auth;

  if (isSeller(auth)) {
    const owns = await verifyProductOwnership(auth, id);
    if (!owns) return jsonError("Product not found", 404);
  }

  try {
    const body = await req.json();
    const { imageId } = body;
    if (!imageId) return jsonError("Missing imageId");

    // Unset all primary for this product
    await prisma.productImage.updateMany({
      where: { productId: id, isPrimary: true },
      data: { isPrimary: false },
    });

    // Set the target image as primary
    await prisma.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });

    return jsonOk({ success: true });
  } catch (error) {
    console.error("[api/admin/products/id/images PATCH]", error);
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

  if (isSeller(auth)) {
    const owns = await verifyProductOwnership(auth, id);
    if (!owns) return jsonError("Product not found", 404);
  }

  try {
    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("imageId");
    if (!imageId) return jsonError("Missing imageId");

    await prisma.productImage.delete({
      where: { id: imageId },
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    console.error("[api/admin/products/id/images DELETE]", error);
    return jsonError("Internal server error", 500);
  }
}
