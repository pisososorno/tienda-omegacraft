import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";

function hashRedeemToken(token: string): string {
  const salt = process.env.REDEEM_TOKEN_SALT || "redeem-default-salt";
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

// GET — validate redeem token and return sale info (no auth required)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const tokenHash = hashRedeemToken(token);

    const sale = await prisma.manualSale.findFirst({
      where: { redeemTokenHash: tokenHash },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            shortDescription: true,
            category: true,
            priceUsd: true,
            images: { where: { isPrimary: true }, take: 1 },
            supportedVersions: true,
            platforms: true,
            minecraftVersionMin: true,
            minecraftVersionMax: true,
          },
        },
      },
    });

    if (!sale) {
      return jsonError("Este enlace no es válido.", 404);
    }

    // Check status
    if (sale.status === "canceled") {
      return jsonError("Esta venta fue cancelada.", 410);
    }
    if (sale.status === "redeemed" && sale.redeemCount >= sale.maxRedeems) {
      return jsonError("Este enlace ya fue utilizado.", 410);
    }
    if (sale.status === "expired" || new Date() > sale.redeemExpiresAt) {
      return jsonError("Este enlace ha expirado.", 410);
    }
    if (sale.requirePaymentFirst && sale.status === "sent") {
      return jsonError("El pago aún no ha sido confirmado. Contacta al vendedor.", 402);
    }

    // Return public info
    const coverImage = sale.product.images[0]?.storageKey || null;

    return jsonOk({
      id: sale.id,
      product: {
        name: sale.product.name,
        slug: sale.product.slug,
        shortDescription: sale.product.shortDescription,
        category: sale.product.category,
        priceUsd: sale.product.priceUsd.toString(),
        coverImage: coverImage
          ? coverImage.startsWith("/") || coverImage.startsWith("http")
            ? coverImage
            : `/${coverImage}`
          : null,
        supportedVersions: sale.product.supportedVersions,
        platforms: sale.product.platforms,
        minecraftVersionMin: sale.product.minecraftVersionMin,
        minecraftVersionMax: sale.product.minecraftVersionMax,
      },
      amount: sale.amount.toString(),
      currency: sale.currency,
      paymentMethod: sale.paymentMethod,
      buyerName: sale.buyerName,
      expiresAt: sale.redeemExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[api/redeem/token GET]", error);
    return jsonError("Error interno", 500);
  }
}
