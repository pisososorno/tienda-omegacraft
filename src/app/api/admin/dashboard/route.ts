import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const [totalOrders, disputedOrders, frozenOrders, revenueResult] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: "disputed" } }),
        prisma.order.count({ where: { status: "frozen" } }),
        prisma.order.aggregate({
          _sum: { amountUsd: true },
          where: { status: { in: ["paid", "confirmed"] } },
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
