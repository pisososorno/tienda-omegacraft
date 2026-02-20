import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/forensic";
import { generateDownloadToken } from "@/lib/tokens";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";

const NewTokenSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().email(),
  stageId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = NewTokenSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0].message, 422);
    }

    const { orderId, email, stageId } = parsed.data;
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.buyerEmail !== email) {
      return jsonError("Order not found", 404);
    }

    if (order.status === "frozen") {
      await appendEvent({
        orderId: order.id,
        eventType: "download.denied_frozen",
        eventData: { source: "new-token", result: "DENIED_FROZEN" },
        ipAddress: ip,
        userAgent: ua,
      });
      return jsonError("Downloads are frozen for this order", 403);
    }

    if (order.status === "refunded" || order.downloadsRevoked) {
      return jsonError("Downloads have been revoked", 403);
    }

    if (order.downloadsExpireAt && new Date() > order.downloadsExpireAt) {
      return jsonError("Download period has expired", 410);
    }

    if (order.downloadCount >= order.downloadLimit) {
      return jsonError("Download limit reached", 429);
    }

    // Check stage if provided
    if (stageId) {
      const stage = await prisma.deliveryStage.findUnique({
        where: { id: stageId },
      });
      if (!stage || stage.orderId !== orderId) {
        return jsonError("Stage not found", 404);
      }
      if (stage.status !== "ready" && stage.status !== "delivered") {
        return jsonError("Stage not yet released", 403);
      }
      if (stage.downloadCount >= stage.downloadLimit) {
        return jsonError("Stage download limit reached", 429);
      }
    }

    const { rawToken, tokenHash, expiresAt } = generateDownloadToken(
      orderId,
      stageId,
      15
    );

    await prisma.downloadToken.create({
      data: {
        orderId,
        tokenHash,
        stageId: stageId || null,
        expiresAt,
      },
    });

    await appendEvent({
      orderId,
      eventType: "download.token_generated",
      eventData: {
        tokenHashPrefix: tokenHash.substring(0, 8),
        expiresAt: expiresAt.toISOString(),
        stageId: stageId || null,
        source: "my-downloads",
      },
      ipAddress: ip,
      userAgent: ua,
    });

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const downloadUrl = `${appUrl}/api/download/${rawToken}`;

    return jsonOk({ downloadUrl });
  } catch (error) {
    console.error("[api/my-downloads/new-token]", error);
    return jsonError("Internal server error", 500);
  }
}
