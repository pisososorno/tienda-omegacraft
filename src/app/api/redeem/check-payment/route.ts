import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { isPayPalConfigured, extractInvoiceId, getInvoiceStatus } from "@/lib/paypal";

function hashRedeemToken(token: string): string {
  const salt = process.env.REDEEM_TOKEN_SALT || "redeem-default-salt";
  return createHash("sha256").update(`${salt}:${token}`).digest("hex");
}

/**
 * POST /api/redeem/check-payment
 * Called by the redeem page polling to check if an invoice has been paid.
 * If PayPal API is configured and the invoice is paid, auto-updates ManualSale to "paid".
 * If no API configured, returns current status (manual confirmation by admin).
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return jsonError("Token requerido", 400);

    const tokenHash = hashRedeemToken(token);

    const sale = await prisma.manualSale.findFirst({
      where: { redeemTokenHash: tokenHash },
      select: {
        id: true,
        status: true,
        paymentRef: true,
        paymentMethod: true,
        requirePaymentFirst: true,
      },
    });

    if (!sale) return jsonError("Enlace no válido", 404);

    // If already paid or redeemed, no need to check
    if (sale.status === "paid" || sale.status === "redeemed") {
      return jsonOk({ status: sale.status, paid: true });
    }

    // If not pending payment, nothing to check
    if (!sale.requirePaymentFirst || sale.status !== "sent") {
      return jsonOk({ status: sale.status, paid: false });
    }

    // Try to auto-detect payment via PayPal Invoicing API
    if (sale.paymentRef && sale.paymentMethod === "paypal_invoice") {
      const configured = await isPayPalConfigured();
      if (configured) {
        const invoiceId = extractInvoiceId(sale.paymentRef);
        if (invoiceId) {
          const invoiceStatus = await getInvoiceStatus(invoiceId);
          if (invoiceStatus?.paid) {
            // Auto-mark as paid!
            await prisma.manualSale.update({
              where: { id: sale.id },
              data: {
                status: "paid",
                paidAt: new Date(),
                metadata: {
                  autoConfirmedVia: "paypal_invoicing_api",
                  invoiceStatus: invoiceStatus.status,
                  invoiceId: invoiceStatus.invoiceId,
                  confirmedAt: new Date().toISOString(),
                },
              },
            });
            return jsonOk({
              status: "paid",
              paid: true,
              autoConfirmed: true,
            });
          }
          // Invoice exists but not paid yet
          return jsonOk({
            status: sale.status,
            paid: false,
            invoiceStatus: invoiceStatus?.status || "unknown",
            checking: true,
          });
        }
      }
    }

    // No API configured or no invoice ID → manual confirmation only
    return jsonOk({
      status: sale.status,
      paid: false,
      checking: false,
    });
  } catch (error) {
    console.error("[api/redeem/check-payment]", error);
    return jsonError("Error interno", 500);
  }
}
