import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/forensic";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";

/**
 * Public tracking endpoint — records forensic events from the buyer's browser.
 * Only whitelisted event types are accepted. orderId + email must match.
 * Includes simple rate limiting and origin validation.
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

// ── Simple in-memory rate limiter (per IP, 20 req/min) ──
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_MAX;
}

// Cleanup stale buckets every 5 min
if (typeof globalThis !== "undefined") {
  const CLEANUP_INTERVAL = 300_000;
  const key = "__trackRateCleanup";
  const g = globalThis as Record<string, unknown>;
  if (!g[key]) {
    g[key] = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of rateBuckets) {
        if (now > v.resetAt) rateBuckets.delete(k);
      }
    }, CLEANUP_INTERVAL);
  }
}

function isOriginAllowed(req: NextRequest): boolean {
  const appUrl = process.env.APP_URL || "";
  if (!appUrl) return true; // No APP_URL = skip check (dev)
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";
  if (origin && origin.startsWith(appUrl)) return true;
  if (referer && referer.startsWith(appUrl)) return true;
  // Allow if neither header sent (some browsers/privacy)
  if (!origin && !referer) return true;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // Origin check
    if (!isOriginAllowed(req)) {
      return jsonError("Forbidden", 403);
    }

    // Rate limit
    if (isRateLimited(ip)) {
      return jsonError("Too many requests", 429);
    }

    const body = await req.json();
    const parsed = TrackSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0].message, 422);
    }

    const { orderId, email, eventType, extra } = parsed.data;
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
