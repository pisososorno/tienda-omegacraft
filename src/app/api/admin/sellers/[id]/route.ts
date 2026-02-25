import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_SUPER, logAudit } from "@/lib/rbac";
import { z } from "zod";

const updateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  payoutEmail: z.string().email().nullable().optional(),
  payoutMethod: z.string().max(50).optional(),
  status: z.enum(["pending", "active", "suspended", "disabled"]).optional(),
  canSellPlugins: z.boolean().optional(),
  canSellMaps: z.boolean().optional(),
  canSellConfigurations: z.boolean().optional(),
  canSellSourceCode: z.boolean().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  holdDays: z.number().int().min(0).max(90).optional(),
  reserveRate: z.number().min(0).max(1).optional(),
});

// GET /api/admin/sellers/[id] — get seller profile detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

  try {
    const profile = await prisma.sellerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, role: true, disabledAt: true } },
        _count: { select: { products: true } },
      },
    });

    if (!profile) return jsonError("Seller profile not found", 404);

    return jsonOk({
      id: profile.id,
      userId: profile.userId,
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
      user: profile.user,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[api/admin/sellers/id GET]", error);
    return jsonError("Internal server error", 500);
  }
}

// PATCH /api/admin/sellers/[id] — update seller profile (status, categories, financial)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const existing = await prisma.sellerProfile.findUnique({ where: { id } });
    if (!existing) return jsonError("Seller profile not found", 404);

    const data = parsed.data;

    // Track what changed for audit
    const changes: Record<string, unknown> = {};

    if (data.status !== undefined && data.status !== existing.status) {
      changes.statusChange = { from: existing.status, to: data.status };
      await logAudit(req, auth.userId, "seller_status_changed", {
        profileId: id,
        from: existing.status,
        to: data.status,
      }, existing.userId);
    }

    const catFields = ["canSellPlugins", "canSellMaps", "canSellConfigurations", "canSellSourceCode"] as const;
    const catChanges: Record<string, boolean> = {};
    for (const field of catFields) {
      if (data[field] !== undefined && data[field] !== existing[field]) {
        catChanges[field] = data[field]!;
      }
    }
    if (Object.keys(catChanges).length > 0) {
      changes.categories = catChanges;
      await logAudit(req, auth.userId, "seller_categories_changed", {
        profileId: id,
        changes: catChanges,
      }, existing.userId);
    }

    const updateData: Record<string, unknown> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.payoutEmail !== undefined) updateData.payoutEmail = data.payoutEmail;
    if (data.payoutMethod !== undefined) updateData.payoutMethod = data.payoutMethod;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.canSellPlugins !== undefined) updateData.canSellPlugins = data.canSellPlugins;
    if (data.canSellMaps !== undefined) updateData.canSellMaps = data.canSellMaps;
    if (data.canSellConfigurations !== undefined) updateData.canSellConfigurations = data.canSellConfigurations;
    if (data.canSellSourceCode !== undefined) updateData.canSellSourceCode = data.canSellSourceCode;
    if (data.commissionRate !== undefined) updateData.commissionRate = data.commissionRate;
    if (data.holdDays !== undefined) updateData.holdDays = data.holdDays;
    if (data.reserveRate !== undefined) updateData.reserveRate = data.reserveRate;

    if (Object.keys(updateData).length === 0) {
      return jsonError("No fields to update", 400);
    }

    const updated = await prisma.sellerProfile.update({
      where: { id },
      data: updateData,
    });

    if (Object.keys(changes).length === 0) {
      await logAudit(req, auth.userId, "seller_profile_updated", {
        profileId: id,
        fields: Object.keys(updateData),
      }, existing.userId);
    }

    return jsonOk({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[api/admin/sellers/id PATCH]", error);
    return jsonError("Internal server error", 500);
  }
}
