import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/forensic";
import { createPayPalOrder } from "@/lib/paypal";
import { generateOrderNumber } from "@/lib/hashing";
import { encryptIp, calculateRetentionExpiry } from "@/lib/privacy";
import { createProductSnapshot, buildProductSnapshotData } from "@/lib/snapshot";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";
import { resolveGeoIp } from "@/lib/geoip";

const CreateOrderSchema = z.object({
  productSlug: z.string().min(1),
  buyerName: z.string().min(2, "Full name is required").max(300),
  buyerEmail: z.string().email(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "Terms must be accepted" }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0].message, 422);
    }

    const { productSlug, buyerName, buyerEmail } = parsed.data;
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    // Resolve IP geolocation (non-blocking, never fails)
    const geo = await resolveGeoIp(ip);

    // 1. Find product
    const product = await prisma.product.findUnique({
      where: { slug: productSlug, isActive: true },
      include: { files: true },
    });
    if (!product) {
      return jsonError("Product not found", 404);
    }

    // 2. Find active terms
    const terms = await prisma.termsVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (!terms) {
      return jsonError("No active terms version", 500);
    }

    // 3. Generate order number
    const orderNumber = generateOrderNumber();
    const amountUsd = product.priceUsd.toString();

    // 4. Encrypt IP
    let buyerIpEncrypted: Buffer | null = null;
    let termsIpEncrypted: Buffer | null = null;
    try {
      buyerIpEncrypted = encryptIp(ip);
      termsIpEncrypted = encryptIp(ip);
    } catch {
      // Continue without encrypted IP if key not configured
    }

    // 5. Create PayPal order
    const { paypalOrderId, approveUrl } = await createPayPalOrder({
      orderNumber,
      amountUsd,
      productName: product.name,
      buyerEmail,
    });

    // 6. Build product snapshot data
    const snapshotData = await buildProductSnapshotData(product.id);

    const now = new Date();

    // 7. Create order in DB
    const order = await prisma.order.create({
      data: {
        orderNumber,
        productId: product.id,
        productSnapshot: snapshotData as unknown as Prisma.InputJsonValue,
        buyerName: buyerName.trim(),
        buyerEmail,
        buyerIp: ip.split(".").slice(0, 1).join(".") + ".xxx.xxx.xxx", // masked
        buyerIpEncrypted,
        buyerUserAgent: ua,
        buyerCountry: geo.country,
        buyerCity: geo.city,
        amountUsd: product.priceUsd,
        status: "pending",
        paypalOrderId,
        downloadLimit: product.downloadLimit,
        termsVersionId: terms.id,
        termsAcceptedAt: now,
        termsAcceptedIp: ip.split(".").slice(0, 1).join(".") + ".xxx.xxx.xxx", // masked
        termsAcceptedIpEncrypted: termsIpEncrypted,
        termsAcceptedUa: ua,
        retentionExpiresAt: calculateRetentionExpiry(now),
      },
    });

    // 8. Create forensic product snapshot
    await createProductSnapshot(order.id, snapshotData);

    // 9. Log order.created event
    await appendEvent({
      orderId: order.id,
      eventType: "order.created",
      eventData: {
        orderNumber,
        productSlug,
        productName: product.name,
        amountUsd,
        paypalOrderId,
        buyerName: buyerName.trim(),
        buyerCountry: geo.country,
        buyerCity: geo.city,
      },
      ipAddress: ip,
      userAgent: ua,
    });

    // 10. Log terms.accepted event
    await appendEvent({
      orderId: order.id,
      eventType: "terms.accepted",
      eventData: {
        termsVersionId: terms.id,
        termsVersionLabel: terms.versionLabel,
        termsContentHash: terms.contentHash,
      },
      ipAddress: ip,
      userAgent: ua,
    });

    return jsonOk({
      orderId: order.id,
      orderNumber,
      paypalOrderId,
      approveUrl,
    });
  } catch (error) {
    console.error("[checkout/create-order]", error);
    return jsonError("Internal server error", 500);
  }
}
