import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";

function hashRedeemToken(token: string): string {
  const salt = process.env.REDEEM_TOKEN_SALT || "redeem-default-salt";
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

const ALLOWED_EVENT_TYPES = [
  "redeem.page_viewed",
  "redeem.terms_link_clicked",
  "redeem.terms_accepted",
  "redeem.confirm_clicked",
  "redeem.payment_page_viewed",
  "redeem.payment_link_clicked",
];

interface BufferedInteraction {
  eventType: string;
  timestamp: string;
  ip: string;
  ua: string;
  data?: Record<string, unknown>;
}

/**
 * POST /api/redeem/events
 * Buffers pre-order interaction events on the ManualSale record.
 * These are replayed as proper forensic OrderEvents when confirm is called.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, eventType, data } = body;

    if (!token || typeof token !== "string") {
      return jsonError("Token required", 400);
    }
    if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType)) {
      return jsonError("Invalid event type", 400);
    }

    const tokenHash = hashRedeemToken(token);
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    const sale = await prisma.manualSale.findFirst({
      where: { redeemTokenHash: tokenHash },
      select: { id: true, status: true, redeemInteractions: true },
    });

    if (!sale) return jsonError("Invalid token", 404);

    // Only buffer for active sales (not yet redeemed/canceled/expired)
    if (sale.status === "canceled" || sale.status === "expired") {
      return jsonError("Sale is no longer active", 410);
    }

    // Build the new interaction entry
    const interaction: BufferedInteraction = {
      eventType,
      timestamp: new Date().toISOString(),
      ip,
      ua,
      ...(data && typeof data === "object" ? { data } : {}),
    };

    // Append to existing interactions array
    const existing = (sale.redeemInteractions as BufferedInteraction[] | null) || [];

    // Deduplicate: don't log the same event type more than 3 times (prevent spam)
    const sameTypeCount = existing.filter((e) => e.eventType === eventType).length;
    if (sameTypeCount >= 3) {
      return jsonOk({ buffered: false, reason: "event_limit_reached" });
    }

    const updated = [...existing, interaction];

    await prisma.manualSale.update({
      where: { id: sale.id },
      data: {
        redeemInteractions: updated as unknown as Prisma.InputJsonValue,
      },
    });

    return jsonOk({ buffered: true, eventType });
  } catch (error) {
    console.error("[redeem/events]", error);
    return jsonError("Internal error", 500);
  }
}
