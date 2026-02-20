import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;

    const where: Record<string, unknown> = {};
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

    return jsonOk({
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        buyerEmail: o.buyerEmail,
        productName: o.product.name,
        productCategory: o.product.category,
        amountUsd: o.amountUsd.toString(),
        status: o.status,
        paypalOrderId: o.paypalOrderId,
        downloadCount: o.downloadCount,
        downloadLimit: o.downloadLimit,
        evidenceFrozenAt: o.evidenceFrozenAt?.toISOString() || null,
        createdAt: o.createdAt.toISOString(),
        eventCount: o._count.events,
      })),
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
