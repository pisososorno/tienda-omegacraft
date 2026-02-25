import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ALL, scopeOrdersWhere, isSeller } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;

    // Scoping: SELLER only sees orders for their products
    const where: Record<string, unknown> = { ...scopeOrdersWhere(auth) };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { buyerEmail: { contains: search, mode: "insensitive" } },
        { paypalOrderId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          product: { select: { name: true, slug: true, category: true } },
          _count: { select: { events: true, downloadTokens: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // SELLER: filtered payload (no forensic/paypal details)
    const mapOrder = (o: (typeof orders)[number]) => {
      const base = {
        id: o.id,
        orderNumber: o.orderNumber,
        productName: o.product.name,
        productCategory: o.product.category,
        amountUsd: o.amountUsd.toString(),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      };
      if (isSeller(auth)) return base;
      return {
        ...base,
        buyerEmail: o.buyerEmail,
        paypalOrderId: o.paypalOrderId,
        downloadCount: o.downloadCount,
        downloadLimit: o.downloadLimit,
        evidenceFrozenAt: o.evidenceFrozenAt?.toISOString() || null,
        eventCount: o._count.events,
      };
    };

    return jsonOk({
      orders: orders.map(mapOrder),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[admin/orders]", error);
    return jsonError("Internal server error", 500);
  }
}
