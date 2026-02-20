import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/forensic";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const orderNumber = searchParams.get("orderNumber");

    if (!email && !orderNumber) {
      return jsonError("Email or order number required", 400);
    }

    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    const where: Record<string, unknown> = {};
    if (email) where.buyerEmail = email;
    if (orderNumber) where.orderNumber = orderNumber;

    const orders = await prisma.order.findMany({
      where,
      include: {
        product: { select: { name: true } },
        deliveryStages: {
          orderBy: { stageOrder: "asc" },
          select: {
            id: true,
            stageType: true,
            stageOrder: true,
            status: true,
            filename: true,
            downloadCount: true,
            downloadLimit: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Log access page viewed for each order found
    for (const order of orders) {
      await appendEvent({
        orderId: order.id,
        eventType: "download.access_page_viewed",
        eventData: { source: "my-downloads", searchedBy: email ? "email" : "orderNumber" },
        ipAddress: ip,
        userAgent: ua,
      });
    }

    const result = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      productName: o.product.name,
      status: o.status,
      downloadCount: o.downloadCount,
      downloadLimit: o.downloadLimit,
      downloadsExpireAt: o.downloadsExpireAt?.toISOString() || null,
      createdAt: o.createdAt.toISOString(),
      stages: o.deliveryStages,
    }));

    return jsonOk({ orders: result });
  } catch (error) {
    console.error("[api/my-downloads]", error);
    return jsonError("Internal server error", 500);
  }
}
