import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, logAudit } from "@/lib/rbac";
import { extractInvoiceId, getInvoiceStatus, isPayPalConfigured } from "@/lib/paypal";

const ADMIN_ROLES: ("SUPER_ADMIN" | "STORE_ADMIN")[] = ["SUPER_ADMIN", "STORE_ADMIN"];

/**
 * POST /api/admin/manual-sales/[id]/verify-invoice
 * Attempts to verify a PayPal invoice via the Invoicing API.
 * Updates the ManualSale record with verified data.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ADMIN_ROLES });
  if (isAuthError(auth)) return auth;

  try {
    const sale = await prisma.manualSale.findUnique({
      where: { id },
      select: {
        id: true,
        paymentRef: true,
        paypalInvoiceId: true,
        amount: true,
        currency: true,
        verifiedViaApi: true,
      },
    });
    if (!sale) return jsonError("Manual sale not found", 404);

    // Check if PayPal API is configured
    const configured = await isPayPalConfigured();
    if (!configured) {
      return jsonError("PayPal API not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.", 400);
    }

    // Extract invoice ID from paymentRef or existing paypalInvoiceId
    let invoiceId = sale.paypalInvoiceId;
    if (!invoiceId && sale.paymentRef) {
      invoiceId = extractInvoiceId(sale.paymentRef);
    }
    if (!invoiceId) {
      return jsonError("No PayPal Invoice ID found. Provide an invoice URL or ID.", 400);
    }

    // Query PayPal API
    const result = await getInvoiceStatus(invoiceId);
    if (!result) {
      return jsonError(`PayPal API returned no data for invoice ${invoiceId}. It may not exist or the API credentials may not have access.`, 400);
    }

    // Check for amount mismatch
    const saleAmount = Number(sale.amount);
    const paidAmount = result.amountPaid ? Number(result.amountPaid) : null;
    const dueAmount = result.amountDue ? Number(result.amountDue) : null;
    const amountToCompare = paidAmount || dueAmount;
    let amountMismatch = false;
    if (amountToCompare !== null && Math.abs(amountToCompare - saleAmount) > 0.01) {
      amountMismatch = true;
    }

    // Update ManualSale with verified data
    const now = new Date();
    await prisma.manualSale.update({
      where: { id },
      data: {
        paypalInvoiceId: invoiceId,
        paypalStatus: result.status,
        verifiedViaApi: true,
        verifiedAt: now,
        paypalRaw: result as unknown as Prisma.InputJsonValue,
        ...(result.paid && !sale.verifiedViaApi ? { paidAt: now } : {}),
      },
    });

    // Also update linked Order if exists
    const saleWithOrder = await prisma.manualSale.findUnique({
      where: { id },
      select: { orderId: true },
    });
    if (saleWithOrder?.orderId) {
      await prisma.order.update({
        where: { id: saleWithOrder.orderId },
        data: {
          paypalInvoiceId: invoiceId,
          paypalTransactionId: sale.paypalInvoiceId !== invoiceId ? invoiceId : undefined,
          paypalStatus: result.status,
        },
      });
    }

    await logAudit(req, auth.userId, "manual_sale.invoice_verified", {
      manualSaleId: id,
      invoiceId,
      status: result.status,
      paid: result.paid,
      amountMismatch,
    });

    return jsonOk({
      invoiceId,
      status: result.status,
      paid: result.paid,
      amountDue: result.amountDue || null,
      amountPaid: result.amountPaid || null,
      currency: result.currency || null,
      amountMismatch,
      saleAmount: saleAmount.toFixed(2),
      verifiedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[verify-invoice]", error);
    return jsonError("Failed to verify invoice", 500);
  }
}
