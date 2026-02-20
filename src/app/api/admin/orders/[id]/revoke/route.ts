import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/forensic";
import { jsonError, jsonOk } from "@/lib/api-helpers";

/**
 * Revoke downloads for an order WITHOUT freezing evidence.
 * Use this for soft revocation (e.g., refund granted, suspicious activity).
 * Does NOT delete any logs (append-only chain preserved).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return jsonError("Unauthorized", 401);

  try {
    let reason = "admin_manual_revoke";
    try {
      const body = await req.json();
      if (body.reason && typeof body.reason === "string") {
        reason = body.reason;
      }
    } catch {
      // No body or invalid JSON — use default reason
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        downloadsRevoked: true,
      },
    });

    if (!order) return jsonError("Order not found", 404);

    if (order.downloadsRevoked) {
      return jsonError("Downloads already revoked for this order", 409);
    }

    const adminEmail = session.user.email;

    // Revoke downloads (do NOT change status to frozen)
    await prisma.order.update({
      where: { id: order.id },
      data: { downloadsRevoked: true },
    });

    // Log event in append-only chain
    await appendEvent({
      orderId: order.id,
      eventType: "admin.downloads_revoked",
      eventData: {
        reason,
        revokedBy: adminEmail,
        previousStatus: order.status,
        note: "Revoked without evidence freeze",
      },
    });

    // Also revoke any pending delivery stages
    const revokedStages = await prisma.deliveryStage.updateMany({
      where: {
        orderId: order.id,
        status: { in: ["pending", "ready"] },
      },
      data: { status: "revoked" },
    });

    if (revokedStages.count > 0) {
      await appendEvent({
        orderId: order.id,
        eventType: "admin.stages_revoked",
        eventData: {
          revokedCount: revokedStages.count,
          revokedBy: adminEmail,
          reason,
        },
      });
    }

    return jsonOk({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      downloadsRevoked: true,
      stagesRevoked: revokedStages.count,
      reason,
      revokedBy: adminEmail,
      message: "Downloads revoked. Delivery stages revoked. Event chain updated.",
    });
  } catch (error) {
    console.error("[admin/orders/id/revoke]", error);
    return jsonError("Internal server error", 500);
  }
}
