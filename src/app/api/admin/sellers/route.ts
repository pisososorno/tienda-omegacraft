import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_SUPER, logAudit } from "@/lib/rbac";
import { z } from "zod";

// GET /api/admin/sellers — list all seller profiles
export async function GET(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

  try {
    const profiles = await prisma.sellerProfile.findMany({
      include: {
        user: {
          select: { id: true, email: true, name: true, disabledAt: true },
        },
        products: {
          select: {
            id: true,
            orders: {
              select: { amountUsd: true, status: true },
            },
          },
        },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return jsonOk(
      profiles.map((p) => {
        const allOrders = p.products.flatMap((prod) => prod.orders);
        const paidOrders = allOrders.filter((o) => ["paid", "confirmed"].includes(o.status));
        const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.amountUsd), 0);
        const totalOrders = allOrders.length;
        const activeProducts = p._count.products;

        return {
          id: p.id,
          userId: p.userId,
          displayName: p.displayName,
          payoutEmail: p.payoutEmail,
          payoutMethod: p.payoutMethod,
          status: p.status,
          canSellPlugins: p.canSellPlugins,
          canSellMaps: p.canSellMaps,
          canSellConfigurations: p.canSellConfigurations,
          canSellSourceCode: p.canSellSourceCode,
          commissionRate: p.commissionRate.toString(),
          holdDays: p.holdDays,
          reserveRate: p.reserveRate.toString(),
          productCount: activeProducts,
          totalOrders,
          totalRevenue: totalRevenue.toFixed(2),
          userEmail: p.user.email,
          userName: p.user.name,
          userDisabled: !!p.user.disabledAt,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      })
    );
  } catch (error) {
    console.error("[api/admin/sellers GET]", error);
    return jsonError("Internal server error", 500);
  }
}

const createSchema = z.object({
  userId: z.string().uuid("ID de usuario inválido"),
  displayName: z.string().min(1).max(200),
  payoutEmail: z.string().email().optional(),
  canSellPlugins: z.boolean().default(false),
  canSellMaps: z.boolean().default(false),
  canSellConfigurations: z.boolean().default(false),
  canSellSourceCode: z.boolean().default(false),
});

// POST /api/admin/sellers — create seller profile for existing user
export async function POST(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_SUPER });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const { userId, displayName, payoutEmail, canSellPlugins, canSellMaps, canSellConfigurations, canSellSourceCode } = parsed.data;

    // Verify user exists and has SELLER role
    const user = await prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user) return jsonError("Usuario no encontrado", 404);

    // Auto-set role to SELLER if not already
    if (user.role !== "SELLER") {
      await prisma.adminUser.update({
        where: { id: userId },
        data: { role: "SELLER" },
      });
      await logAudit(req, auth.userId, "role_changed", { previousRole: user.role, newRole: "SELLER" }, userId);
    }

    // Check if profile already exists
    const existing = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (existing) return jsonError("Este usuario ya tiene perfil de seller", 409);

    const profile = await prisma.sellerProfile.create({
      data: {
        userId,
        displayName,
        payoutEmail: payoutEmail || null,
        canSellPlugins,
        canSellMaps,
        canSellConfigurations,
        canSellSourceCode,
        status: "active",
      },
    });

    await logAudit(req, auth.userId, "seller_profile_created", {
      profileId: profile.id,
      displayName,
      categories: { canSellPlugins, canSellMaps, canSellConfigurations, canSellSourceCode },
    }, userId);

    return jsonOk({ id: profile.id, status: profile.status }, 201);
  } catch (error) {
    console.error("[api/admin/sellers POST]", error);
    return jsonError("Internal server error", 500);
  }
}
