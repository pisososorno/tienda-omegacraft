import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/forensic";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";

/**
 * Public tracking endpoint — records forensic events from the buyer's browser.
 * Only whitelisted event types are accepted. orderId + email must match.
 */

const ALLOWED_EVENTS = [
  "checkout.success_viewed",
  "downloads.page_viewed",
  "download.button_clicked",
  "download.link_opened",
] as const;

const TrackSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().email(),
  eventType: z.enum(ALLOWED_EVENTS),
  extra: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = TrackSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0].message, 422);
    }

    const { orderId, email, eventType, extra } = parsed.data;
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    // Verify order belongs to email
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerEmail: true },
    });

    if (!order || order.buyerEmail !== email) {
      return jsonError("Order not found", 404);
    }

    await appendEvent({
      orderId,
      eventType,
      eventData: { source: "browser", ...extra },
      ipAddress: ip,
      userAgent: ua,
    });

    return jsonOk({ tracked: true });
  } catch (error) {
    console.error("[api/track]", error);
    return jsonError("Internal server error", 500);
  }
}
