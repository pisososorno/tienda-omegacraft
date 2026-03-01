import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/forensic";
import { generateDownloadToken } from "@/lib/tokens";
import { generateOrderNumber, generateLicenseKey, sha256 } from "@/lib/hashing";
import { encryptIp, maskIp, calculateRetentionExpiry } from "@/lib/privacy";
import { createProductSnapshot, buildProductSnapshotData } from "@/lib/snapshot";
import { getClientIp, getUserAgent, jsonError, jsonOk } from "@/lib/api-helpers";
import { resolveGeoIp } from "@/lib/geoip";
import { sendPurchaseEmail } from "@/lib/mailer";

function hashRedeemToken(token: string): string {
  const salt = process.env.REDEEM_TOKEN_SALT || "redeem-default-salt";
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, termsAccepted, buyerName } = body;

    if (!token) return jsonError("Token requerido", 400);
    if (!termsAccepted) return jsonError("Debes aceptar los términos y condiciones", 400);

    const ip = getClientIp(req);
    const ua = getUserAgent(req);
    const geo = await resolveGeoIp(ip);

    const tokenHash = hashRedeemToken(token);

    // 1. Find and validate manual sale
    const sale = await prisma.manualSale.findFirst({
      where: { redeemTokenHash: tokenHash },
      include: {
        product: { include: { files: true } },
      },
    });

    if (!sale) return jsonError("Enlace no válido.", 404);
    if (sale.status === "canceled") return jsonError("Esta venta fue cancelada.", 410);
    if (sale.status === "redeemed" && sale.redeemCount >= sale.maxRedeems) {
      return jsonError("Este enlace ya fue utilizado.", 410);
    }
    if (new Date() > sale.redeemExpiresAt) {
      await prisma.manualSale.update({ where: { id: sale.id }, data: { status: "expired" } });
      return jsonError("Este enlace ha expirado.", 410);
    }
    if (sale.requirePaymentFirst && sale.status === "sent") {
      return jsonError("El pago aún no ha sido confirmado.", 402);
    }

    // 2. Find active terms
    const terms = await prisma.termsVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (!terms) return jsonError("No hay términos activos", 500);

    // 3. Generate order data
    const orderNumber = generateOrderNumber();
    const now = new Date();

    let buyerIpEncrypted: Buffer | null = null;
    let termsIpEncrypted: Buffer | null = null;
    try {
      buyerIpEncrypted = encryptIp(ip);
      termsIpEncrypted = encryptIp(ip);
    } catch {
      // Continue without encrypted IP
    }

    // 4. Build product snapshot
    const snapshotData = await buildProductSnapshotData(sale.product.id);

    // 5. Create order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        productId: sale.product.id,
        productSnapshot: snapshotData as unknown as Prisma.InputJsonValue,
        buyerName: (buyerName || sale.buyerName || "").trim(),
        buyerEmail: sale.buyerEmail,
        buyerIp: maskIp(ip),
        buyerIpEncrypted,
        buyerUserAgent: ua,
        buyerCountry: geo.country,
        buyerCity: geo.city,
        amountUsd: sale.amount,
        currency: sale.currency,
        status: "paid", // Already paid via invoice/manual
        downloadLimit: sale.product.downloadLimit,
        termsVersionId: terms.id,
        termsAcceptedAt: now,
        termsAcceptedIp: maskIp(ip),
        termsAcceptedIpEncrypted: termsIpEncrypted,
        termsAcceptedUa: ua,
        retentionExpiresAt: calculateRetentionExpiry(now),
      },
    });

    // 6. Create forensic snapshot
    await createProductSnapshot(order.id, snapshotData);

    // 7. Generate license
    const licenseKey = generateLicenseKey();
    const fingerprint = sha256(
      `${order.id}|${sale.product.id}|${sale.buyerEmail}|${Date.now()}`
    );

    // 8. Calculate download expiration
    const downloadsExpireAt = new Date();
    downloadsExpireAt.setDate(
      downloadsExpireAt.getDate() + sale.product.downloadExpiresDays
    );

    // 9. Generate download token
    const { rawToken, tokenHash: dlTokenHash, expiresAt } = generateDownloadToken(
      order.id,
      undefined,
      60 // 60 minutes for redeem flow (more generous than checkout)
    );

    // 10. Create license + download token in transaction
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { downloadsExpireAt },
      }),
      prisma.license.create({
        data: {
          orderId: order.id,
          productId: sale.product.id,
          licenseKey,
          buyerEmail: sale.buyerEmail,
          fingerprint,
          status: "active",
        },
      }),
      prisma.downloadToken.create({
        data: {
          orderId: order.id,
          tokenHash: dlTokenHash,
          expiresAt,
        },
      }),
    ]);

    // 11. Update manual sale
    await prisma.manualSale.update({
      where: { id: sale.id },
      data: {
        status: "redeemed",
        redeemCount: { increment: 1 },
        redeemedAt: now,
        orderId: order.id,
      },
    });

    // 12. Create delivery stages if source_code
    if (sale.product.category === "source_code") {
      for (let i = 0; i < sale.product.files.length; i++) {
        await prisma.deliveryStage.create({
          data: {
            orderId: order.id,
            stageType: i === 0 ? "preview" : "full",
            stageOrder: i + 1,
            status: i === 0 ? "ready" : "pending",
            storageKey: sale.product.files[i].storageKey,
            sha256Hash: sale.product.files[i].sha256Hash,
            filename: sale.product.files[i].filename,
            fileSize: sale.product.files[i].fileSize,
            downloadLimit: sale.product.downloadLimit,
          },
        });
      }
    }

    // 13. Log events (full evidence chain)
    await appendEvent({
      orderId: order.id,
      eventType: "order.created",
      eventData: {
        orderNumber,
        source: "manual_sale",
        manualSaleId: sale.id,
        productSlug: sale.product.slug,
        productName: sale.product.name,
        amountUsd: sale.amount.toString(),
        paymentMethod: sale.paymentMethod,
        paymentRef: sale.paymentRef,
        buyerName: (buyerName || sale.buyerName || "").trim(),
        buyerCountry: geo.country,
        buyerCity: geo.city,
      },
      ipAddress: ip,
      userAgent: ua,
    });

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

    await appendEvent({
      orderId: order.id,
      eventType: "payment.recorded",
      eventData: {
        method: sale.paymentMethod,
        paymentRef: sale.paymentRef,
        manualSaleId: sale.id,
        amount: sale.amount.toString(),
        currency: sale.currency,
      },
      ipAddress: ip,
      userAgent: ua,
      externalRef: sale.paymentRef ? `manual:${sale.paymentRef}` : `manual_sale:${sale.id}`,
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
        tokenHashPrefix: dlTokenHash.substring(0, 8),
        expiresAt: expiresAt.toISOString(),
      },
      ipAddress: ip,
      userAgent: ua,
    });

    await appendEvent({
      orderId: order.id,
      eventType: "redeem.completed",
      eventData: {
        manualSaleId: sale.id,
        redeemCount: sale.redeemCount + 1,
      },
      ipAddress: ip,
      userAgent: ua,
    });

    // 14. Build download URL
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const downloadUrl = `${appUrl}/api/download/${rawToken}`;

    // 15. Send email (non-blocking)
    sendPurchaseEmail({
      buyerEmail: sale.buyerEmail,
      orderNumber,
      productName: sale.product.name,
      downloadUrl,
      expiresAt,
      downloadLimit: sale.product.downloadLimit,
      orderId: order.id,
    }).catch((err) => {
      console.error("[redeem/confirm] Email send failed:", err);
    });

    return jsonOk({
      orderId: order.id,
      orderNumber,
      downloadUrl,
      licenseKey,
      productName: sale.product.name,
      expiresAt: expiresAt.toISOString(),
      downloadLimit: sale.product.downloadLimit,
    });
  } catch (error) {
    console.error("[redeem/confirm]", error);
    return jsonError("Error interno del servidor", 500);
  }
}
