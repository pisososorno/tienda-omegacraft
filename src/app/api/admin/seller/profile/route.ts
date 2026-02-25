import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ALL, isSeller, logAudit } from "@/lib/rbac";
import { z } from "zod";

// GET /api/admin/seller/profile — SELLER gets their own profile
export async function GET(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  if (!isSeller(auth)) {
    return jsonError("Only sellers have a seller profile", 400);
  }

  try {
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: auth.userId },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!profile) {
      return jsonError("Seller profile not found. Contact admin.", 404);
    }

    return jsonOk({
      id: profile.id,
      displayName: profile.displayName,
      payoutEmail: profile.payoutEmail,
      payoutMethod: profile.payoutMethod,
      status: profile.status,
      canSellPlugins: profile.canSellPlugins,
      canSellMaps: profile.canSellMaps,
      canSellConfigurations: profile.canSellConfigurations,
      canSellSourceCode: profile.canSellSourceCode,
      commissionRate: profile.commissionRate.toString(),
      holdDays: profile.holdDays,
      reserveRate: profile.reserveRate.toString(),
      productCount: profile._count.products,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[api/admin/seller/profile GET]", error);
    return jsonError("Internal server error", 500);
  }
}

const updateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  payoutEmail: z.string().email().nullable().optional(),
  payoutMethod: z.string().max(50).optional(),
});

// PUT /api/admin/seller/profile — SELLER updates their own profile (limited fields)
export async function PUT(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  if (!isSeller(auth)) {
    return jsonError("Only sellers can edit a seller profile", 400);
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: auth.userId },
    });

    if (!profile) {
      return jsonError("Seller profile not found. Contact admin.", 404);
    }

    // Suspended/disabled sellers cannot edit
    if (profile.status === "suspended" || profile.status === "disabled") {
      return jsonError("Tu cuenta está " + profile.status + ". Contacta al administrador.", 403);
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.payoutEmail !== undefined) updateData.payoutEmail = data.payoutEmail;
    if (data.payoutMethod !== undefined) updateData.payoutMethod = data.payoutMethod;

    if (Object.keys(updateData).length === 0) {
      return jsonError("No fields to update", 400);
    }

    const updated = await prisma.sellerProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    await logAudit(req, auth.userId, "seller_profile_updated", {
      profileId: profile.id,
      fields: Object.keys(updateData),
      selfEdit: true,
    });

    return jsonOk({
      id: updated.id,
      displayName: updated.displayName,
      payoutEmail: updated.payoutEmail,
      payoutMethod: updated.payoutMethod,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[api/admin/seller/profile PUT]", error);
    return jsonError("Internal server error", 500);
  }
}
