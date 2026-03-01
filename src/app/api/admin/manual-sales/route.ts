import { NextRequest } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, logAudit } from "@/lib/rbac";
import type { ManualSaleStatus } from "@prisma/client";

const ADMIN_ROLES: ("SUPER_ADMIN" | "STORE_ADMIN")[] = ["SUPER_ADMIN", "STORE_ADMIN"];

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const visible = local.length <= 2 ? local[0] + "***" : local.slice(0, 2) + "***";
  return `${visible}@${domain}`;
}

function hashRedeemToken(token: string): string {
  const salt = process.env.REDEEM_TOKEN_SALT || "redeem-default-salt";
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

// GET — list manual sales
export async function GET(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ADMIN_ROLES });
  if (isAuthError(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as ManualSaleStatus | null;
    const email = searchParams.get("email");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (email) where.buyerEmail = { contains: email, mode: "insensitive" };

    const sales = await prisma.manualSale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, name: true, slug: true, priceUsd: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
        admin: { select: { id: true, name: true, email: true } },
      },
      take: 100,
    });

    return jsonOk(
      sales.map((s) => ({
        id: s.id,
        status: s.status,
        buyerEmail: s.buyerEmailMasked,
        buyerName: s.buyerName,
        product: s.product,
        amount: s.amount.toString(),
        currency: s.currency,
        paymentMethod: s.paymentMethod,
        paymentRef: s.paymentRef,
        paidAt: s.paidAt?.toISOString() || null,
        requirePaymentFirst: s.requirePaymentFirst,
        redeemExpiresAt: s.redeemExpiresAt.toISOString(),
        maxRedeems: s.maxRedeems,
        redeemCount: s.redeemCount,
        redeemedAt: s.redeemedAt?.toISOString() || null,
        orderId: s.orderId,
        order: s.order,
        notes: s.notes,
        createdBy: s.admin,
        createdAt: s.createdAt.toISOString(),
        // Invoice details
        paypalInvoiceId: s.paypalInvoiceId,
        paypalInvoiceNumber: s.paypalInvoiceNumber,
        paypalTransactionId: s.paypalTransactionId,
        amountSubtotal: s.amountSubtotal?.toString() || null,
        amountTax: s.amountTax?.toString() || null,
        amountDiscount: s.amountDiscount?.toString() || null,
        amountShipping: s.amountShipping?.toString() || null,
        paypalStatus: s.paypalStatus,
        paypalPaidAt: s.paypalPaidAt?.toISOString() || null,
        verifiedViaApi: s.verifiedViaApi,
        verifiedAt: s.verifiedAt?.toISOString() || null,
        paymentVerificationMode: s.paymentVerificationMode,
        paymentProofNote: s.paymentProofNote,
        paypalPayerEmail: s.paypalPayerEmail,
        paypalPayerName: s.paypalPayerName,
      }))
    );
  } catch (error) {
    console.error("[api/admin/manual-sales GET]", error);
    return jsonError("Internal server error", 500);
  }
}

// POST — create a new manual sale
export async function POST(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ADMIN_ROLES });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const {
      buyerEmail,
      buyerName,
      productId,
      amount,
      currency,
      paymentMethod,
      paymentRef,
      notes,
      requirePaymentFirst,
      redeemExpiresDays,
      maxRedeems,
      // Invoice-specific fields
      paypalInvoiceId,
      paypalInvoiceNumber,
      paypalTransactionId,
      amountSubtotal,
      amountTax,
      amountDiscount,
      amountShipping,
      // Verification mode
      paymentVerificationMode,
      paymentProofNote,
    } = body;

    if (!buyerEmail || !productId) {
      return jsonError("buyerEmail and productId are required", 400);
    }

    // Validate product
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, priceUsd: true, isActive: true },
    });
    if (!product) return jsonError("Product not found", 404);

    // Generate redeem token (32 bytes = 64 hex chars)
    const rawRedeemToken = randomBytes(32).toString("hex");
    const redeemTokenHash = hashRedeemToken(rawRedeemToken);

    // Expiration
    const expDays = redeemExpiresDays || 7;
    const redeemExpiresAt = new Date();
    redeemExpiresAt.setDate(redeemExpiresAt.getDate() + expDays);

    const sale = await prisma.manualSale.create({
      data: {
        buyerEmail: buyerEmail.toLowerCase().trim(),
        buyerEmailMasked: maskEmail(buyerEmail),
        buyerName: buyerName || null,
        productId: product.id,
        amount: amount ? parseFloat(amount) : product.priceUsd,
        currency: currency || "USD",
        paymentMethod: paymentMethod || "paypal_invoice",
        paymentRef: paymentRef || null,
        notes: notes || null,
        requirePaymentFirst: requirePaymentFirst || false,
        redeemTokenHash,
        redeemExpiresAt,
        maxRedeems: maxRedeems || 1,
        createdByAdminId: auth.userId,
        status: requirePaymentFirst ? "sent" : "draft",
        // Invoice-specific fields
        paypalInvoiceId: paypalInvoiceId || null,
        paypalInvoiceNumber: paypalInvoiceNumber || null,
        paypalTransactionId: paypalTransactionId || null,
        amountSubtotal: amountSubtotal ? parseFloat(amountSubtotal) : null,
        amountTax: amountTax ? parseFloat(amountTax) : null,
        amountDiscount: amountDiscount ? parseFloat(amountDiscount) : null,
        amountShipping: amountShipping ? parseFloat(amountShipping) : null,
        paymentVerificationMode: paymentVerificationMode || null,
        paymentProofNote: paymentProofNote || null,
      },
    });

    await logAudit(req, auth.userId, "manual_sale.created", {
      manualSaleId: sale.id,
      productId: product.id,
      buyerEmail: maskEmail(buyerEmail),
    });

    // Build redeem URL
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const redeemUrl = `${appUrl}/redeem/${rawRedeemToken}`;

    return jsonOk({
      id: sale.id,
      redeemToken: rawRedeemToken,
      redeemUrl,
      status: sale.status,
      redeemExpiresAt: sale.redeemExpiresAt.toISOString(),
      templateMessage: `Hola${buyerName ? ` ${buyerName}` : ""}, para descargar tu producto "${product.name}": ${redeemUrl}\nDebes aceptar los términos y condiciones para activar tu descarga.`,
    }, 201);
  } catch (error) {
    console.error("[api/admin/manual-sales POST]", error);
    return jsonError("Internal server error", 500);
  }
}
