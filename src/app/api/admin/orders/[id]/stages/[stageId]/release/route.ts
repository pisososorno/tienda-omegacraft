import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth, isAuthError, ROLES_ADMIN } from "@/lib/rbac";
import { appendEvent } from "@/lib/forensic";
import { generateDownloadToken } from "@/lib/tokens";
import { sendStageReleasedEmail } from "@/lib/mailer";
import { jsonError, jsonOk } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  const { id, stageId } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ADMIN });
  if (isAuthError(auth)) return auth;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!order) return jsonError("Order not found", 404);

    if (order.status === "frozen") {
      return jsonError("Order is frozen — cannot release stages", 403);
    }

    const stage = await prisma.deliveryStage.findUnique({
      where: { id: stageId },
    });

    if (!stage || stage.orderId !== order.id) {
      return jsonError("Stage not found", 404);
    }

    if (stage.status === "ready" || stage.status === "delivered") {
      return jsonError("Stage already released", 409);
    }

    if (stage.status === "revoked") {
      return jsonError("Stage has been revoked", 409);
    }

    const now = new Date();

    // Release stage
    await prisma.deliveryStage.update({
      where: { id: stage.id },
      data: {
        status: "ready",
        releasedAt: now,
      },
    });

    // Log event
    await appendEvent({
      orderId: order.id,
      eventType: "admin.stage_released",
      eventData: {
        stageId: stage.id,
        stageType: stage.stageType,
        stageOrder: stage.stageOrder,
        releasedBy: auth.email,
        filename: stage.filename,
        sha256Hash: stage.sha256Hash,
      },
    });

    // Generate download token for the released stage
    const { rawToken, tokenHash, expiresAt } = generateDownloadToken(
      order.id,
      stage.id,
      60 // 1 hour for stage release
    );

    await prisma.downloadToken.create({
      data: {
        orderId: order.id,
        tokenHash,
        stageId: stage.id,
        expiresAt,
      },
    });

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const downloadUrl = `${appUrl}/api/download/${rawToken}`;

    // Send email notification (non-blocking)
    sendStageReleasedEmail({
      buyerEmail: order.buyerEmail,
      orderNumber: order.orderNumber,
      productName: order.product.name,
      stageName: stage.stageType === "full" ? "Full Source Code" : "Preview/Demo",
      downloadUrl,
    }).then(async (result) => {
      await appendEvent({
        orderId: order.id,
        eventType: "email.stage_released_sent",
        eventData: {
          messageId: result.messageId,
          to: order.buyerEmail,
          stageId: stage.id,
        },
      });
    }).catch((err) => {
      console.error("[stages/release] Email failed:", err);
    });

    return jsonOk({
      success: true,
      stageId: stage.id,
      stageType: stage.stageType,
      releasedAt: now.toISOString(),
      releasedBy: auth.email,
      downloadUrl,
    });
  } catch (error) {
    console.error("[admin/orders/id/stages/stageId/release]", error);
    return jsonError("Internal server error", 500);
  }
}
