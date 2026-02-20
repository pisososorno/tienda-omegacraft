import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/forensic";
import {
  verifyWebhookSignature,
  extractPayPalEventId,
  computeWebhookRef,
} from "@/lib/paypal";

/**
 * PayPal Webhook handler.
 * Idempotent: paypal_event_id UNIQUE constraint rejects duplicates at DB level (C).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // 1. Parse payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const paypalEventId = extractPayPalEventId(payload);
    const eventType = (payload.event_type as string) || "UNKNOWN";

    if (!paypalEventId) {
      return new Response("Missing event ID", { status: 400 });
    }

    // 2. Verify signature
    let signatureValid = false;
    try {
      signatureValid = await verifyWebhookSignature(headers, rawBody);
    } catch (err) {
      console.error("[webhook/paypal] Signature verification error:", err);
    }

    // 3. Attempt to insert WebhookLog (idempotency via UNIQUE constraint)
    try {
      await prisma.webhookLog.create({
        data: {
          paypalEventId,
          eventType,
          payload: payload as unknown as Prisma.InputJsonValue,
          signatureValid,
          processed: false,
        },
      });
    } catch (error: unknown) {
      // Duplicate paypal_event_id → already processed, return 200 to stop retries
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        console.log(`[webhook/paypal] Duplicate event ignored: ${paypalEventId}`);
        return new Response("OK (duplicate)", { status: 200 });
      }
      throw error;
    }

    // 4. Reject if signature invalid
    if (!signatureValid) {
      await prisma.webhookLog.update({
        where: { paypalEventId },
        data: {
          processed: true,
          processingResult: "REJECTED: invalid signature",
          processedAt: new Date(),
        },
      });
      return new Response("Invalid signature", { status: 401 });
    }

    // 5. Process based on event type
    let processingResult = "IGNORED: unhandled event type";
    let linkedOrderId: string | null = null;

    try {
      switch (eventType) {
        case "PAYMENT.CAPTURE.COMPLETED": {
          const result = await handleCaptureCompleted(payload, paypalEventId);
          processingResult = result.message;
          linkedOrderId = result.orderId;
          break;
        }
        case "PAYMENT.CAPTURE.REFUNDED":
        case "PAYMENT.CAPTURE.REVERSED": {
          const result = await handleCaptureRefunded(payload, paypalEventId);
          processingResult = result.message;
          linkedOrderId = result.orderId;
          break;
        }
        case "CUSTOMER.DISPUTE.CREATED": {
          const result = await handleDisputeCreated(payload, paypalEventId);
          processingResult = result.message;
          linkedOrderId = result.orderId;
          break;
        }
        default:
          processingResult = `IGNORED: ${eventType}`;
      }
    } catch (err) {
      processingResult = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[webhook/paypal] Processing error for ${eventType}:`, err);
    }

    // 6. Update webhook log
    await prisma.webhookLog.update({
      where: { paypalEventId },
      data: {
        processed: true,
        processingResult,
        linkedOrderId,
        processedAt: new Date(),
      },
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[webhook/paypal] Unhandled error:", error);
    return new Response("Internal error", { status: 500 });
  }
}

// ── Handlers ─────────────────────────────────────────

async function handleCaptureCompleted(
  payload: Record<string, unknown>,
  paypalEventId: string
): Promise<{ message: string; orderId: string | null }> {
  const resource = payload.resource as Record<string, unknown> | undefined;
  if (!resource) return { message: "No resource in payload", orderId: null };

  const captureId = resource.id as string;
  const customId =
    (resource.custom_id as string) ||
    (
      (
        (payload.resource as Record<string, unknown>)
          ?.supplementary_data as Record<string, unknown>
      )?.related_ids as Record<string, unknown>
    )?.order_id as string;

  // Find order by paypal capture ID or custom_id (order number)
  let order = await prisma.order.findFirst({
    where: { paypalCaptureId: captureId },
  });

  if (!order && customId) {
    order = await prisma.order.findFirst({
      where: { orderNumber: customId },
    });
  }

  if (!order) {
    return { message: `No order found for capture ${captureId}`, orderId: null };
  }

  // If already paid via capture route, just log the webhook confirmation
  await appendEvent({
    orderId: order.id,
    eventType: "webhook.payment_confirmed",
    eventData: { captureId, paypalEventId, source: "PAYMENT.CAPTURE.COMPLETED" },
    externalRef: computeWebhookRef(paypalEventId),
  });

  // Update order status to confirmed if currently paid
  if (order.status === "paid") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "confirmed",
        paypalWebhookReceivedAt: new Date(),
      },
    });
  }

  return {
    message: `Confirmed capture ${captureId} for order ${order.orderNumber}`,
    orderId: order.id,
  };
}

async function handleCaptureRefunded(
  payload: Record<string, unknown>,
  paypalEventId: string
): Promise<{ message: string; orderId: string | null }> {
  const resource = payload.resource as Record<string, unknown> | undefined;
  if (!resource) return { message: "No resource in payload", orderId: null };

  // The refund resource links back to the capture
  const captureId = (
    (resource.links as Array<{ rel: string; href: string }>) || []
  ).find((l) => l.rel === "up")?.href?.split("/").pop();

  const order = captureId
    ? await prisma.order.findFirst({ where: { paypalCaptureId: captureId } })
    : null;

  if (!order) {
    return { message: "No order found for refund", orderId: null };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "refunded",
      downloadsRevoked: true,
    },
  });

  await appendEvent({
    orderId: order.id,
    eventType: "payment.refunded",
    eventData: { paypalEventId, refundId: resource.id },
    externalRef: computeWebhookRef(paypalEventId),
  });

  return {
    message: `Refunded order ${order.orderNumber}`,
    orderId: order.id,
  };
}

async function handleDisputeCreated(
  payload: Record<string, unknown>,
  paypalEventId: string
): Promise<{ message: string; orderId: string | null }> {
  const resource = payload.resource as Record<string, unknown> | undefined;
  if (!resource) return { message: "No resource in payload", orderId: null };

  const transactions = resource.disputed_transactions as Array<{
    buyer_transaction_id?: string;
    seller_transaction_id?: string;
    custom?: string;
  }>;

  if (!transactions?.length) {
    return { message: "No transactions in dispute", orderId: null };
  }

  const tx = transactions[0];
  const order = tx.custom
    ? await prisma.order.findFirst({ where: { orderNumber: tx.custom } })
    : tx.seller_transaction_id
      ? await prisma.order.findFirst({
          where: { paypalCaptureId: tx.seller_transaction_id },
        })
      : null;

  if (!order) {
    return { message: "No order found for dispute", orderId: null };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "disputed" },
  });

  await appendEvent({
    orderId: order.id,
    eventType: "dispute.created",
    eventData: {
      paypalEventId,
      disputeId: resource.dispute_id,
      reason: resource.reason,
    },
    externalRef: computeWebhookRef(paypalEventId),
  });

  return {
    message: `Dispute created for order ${order.orderNumber}`,
    orderId: order.id,
  };
}
