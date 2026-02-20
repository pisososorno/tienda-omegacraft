import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/forensic";
import { capturePayPalOrder } from "@/lib/paypal";
import { generateDownloadToken } from "@/lib/tokens";
import { generateLicenseKey, sha256 } from "@/lib/hashing";
import { sendPurchaseEmail } from "@/lib/mailer";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";

const CaptureSchema = z.object({
  orderId: z.string().uuid(),
  paypalOrderId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CaptureSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0].message, 422);
    }

    const { orderId, paypalOrderId } = parsed.data;
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    // 1. Find order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!order) return jsonError("Order not found", 404);
    if (order.paypalOrderId !== paypalOrderId) {
      return jsonError("PayPal order mismatch", 400);
    }
    if (order.status !== "pending") {
      return jsonError("Order already processed", 409);
    }

    // 2. Capture PayPal payment
    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status !== "COMPLETED") {
      await appendEvent({
        orderId: order.id,
        eventType: "payment.capture_failed",
        eventData: { paypalStatus: capture.status, captureId: capture.captureId },
        ipAddress: ip,
        userAgent: ua,
        externalRef: `paypal_capture:${capture.captureId}`,
      });
      return jsonError(`Payment not completed: ${capture.status}`, 400);
    }

    // 3. Generate license
    const licenseKey = generateLicenseKey();
    const fingerprint = sha256(
      `${order.id}|${order.productId}|${order.buyerEmail}|${Date.now()}`
    );

    // 4. Calculate download expiration
    const downloadsExpireAt = new Date();
    downloadsExpireAt.setDate(
      downloadsExpireAt.getDate() + order.product.downloadExpiresDays
    );

    // 5. Generate download token
    const { rawToken, tokenHash, expiresAt } = generateDownloadToken(
      order.id,
      undefined,
      15
    );

    // 6. Update order + create license + download token in transaction
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: "paid",
          paypalCaptureId: capture.captureId,
          paypalPayerId: capture.payerId,
          paypalPayerName: capture.payerName,
          paypalPayerEmail: capture.payerEmail,
          paypalStatus: capture.status,
          paypalRawCapture: capture.rawCapture as unknown as Prisma.InputJsonValue,
          downloadsExpireAt,
        },
      }),
      prisma.license.create({
        data: {
          orderId: order.id,
          productId: order.productId,
          licenseKey,
          buyerEmail: order.buyerEmail,
          fingerprint,
          status: "active",
        },
      }),
      prisma.downloadToken.create({
        data: {
          orderId: order.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    // 7. Create delivery stages if source_code product
    if (order.product.category === "source_code") {
      const files = await prisma.productFile.findMany({
        where: { productId: order.productId },
        orderBy: { sortOrder: "asc" },
      });

      for (let i = 0; i < files.length; i++) {
        await prisma.deliveryStage.create({
          data: {
            orderId: order.id,
            stageType: i === 0 ? "preview" : "full",
            stageOrder: i + 1,
            status: i === 0 ? "ready" : "pending",
            storageKey: files[i].storageKey,
            sha256Hash: files[i].sha256Hash,
            filename: files[i].filename,
            fileSize: files[i].fileSize,
            downloadLimit: order.product.downloadLimit,
          },
        });
      }
    }

    // 8. Log events
    await appendEvent({
      orderId: order.id,
      eventType: "payment.captured",
      eventData: {
        captureId: capture.captureId,
        payerEmail: capture.payerEmail,
        payerId: capture.payerId,
        status: capture.status,
      },
      ipAddress: ip,
      userAgent: ua,
      externalRef: `paypal_capture:${capture.captureId}`,
    });

    await appendEvent({
      orderId: order.id,
      eventType: "license.created",
      eventData: { licenseKey, fingerprint },
      ipAddress: ip,
      userAgent: ua,
    });

    await appendEvent({
      orderId: order.id,
      eventType: "download.token_generated",
      eventData: {
        tokenHashPrefix: tokenHash.substring(0, 8),
        expiresAt: expiresAt.toISOString(),
      },
      ipAddress: ip,
      userAgent: ua,
    });

    // 9. Build download URL
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const downloadUrl = `${appUrl}/api/download/${rawToken}`;

    // 10. Send purchase email (non-blocking)
    sendPurchaseEmail({
      buyerEmail: order.buyerEmail,
      orderNumber: order.orderNumber,
      productName: order.product.name,
      downloadUrl,
      expiresAt,
      downloadLimit: order.downloadLimit,
    }).then(async (result) => {
      await appendEvent({
        orderId: order.id,
        eventType: "email.purchase_sent",
        eventData: { messageId: result.messageId, to: order.buyerEmail },
      });
    }).catch((err) => {
      console.error("[capture] Email send failed:", err);
    });

    return jsonOk({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: "paid",
      downloadUrl,
      licenseKey,
    });
  } catch (error) {
    console.error("[checkout/capture]", error);
    return jsonError("Internal server error", 500);
  }
}
