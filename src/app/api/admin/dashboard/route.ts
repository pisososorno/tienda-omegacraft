import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ALL, scopeOrdersWhere } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  try {
    const scope = scopeOrdersWhere(auth);

    const [totalOrders, disputedOrders, frozenOrders, revenueResult] =
      await Promise.all([
        prisma.order.count({ where: scope }),
        prisma.order.count({ where: { ...scope, status: "disputed" } }),
        prisma.order.count({ where: { ...scope, status: "frozen" } }),
        prisma.order.aggregate({
          _sum: { amountUsd: true },
          where: { ...scope, status: { in: ["paid", "confirmed"] } },
        }),
      ]);

    return jsonOk({
      totalOrders,
      totalRevenue: revenueResult._sum.amountUsd?.toString() || "0.00",
      disputedOrders,
      frozenOrders,
    });
  } catch (error) {
    console.error("[admin/dashboard]", error);
    return jsonError("Internal server error", 500);
  }
}
