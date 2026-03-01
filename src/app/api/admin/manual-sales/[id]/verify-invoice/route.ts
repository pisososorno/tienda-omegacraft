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

    // Update ManualSale with all verified data from API
    const now = new Date();
    const paidAt = result.paymentDate ? new Date(result.paymentDate) : (result.paid ? now : undefined);

    await prisma.manualSale.update({
      where: { id },
      data: {
        paypalInvoiceId: invoiceId,
        paypalInvoiceNumber: result.invoiceNumber || undefined,
        paypalTransactionId: result.transactionId || undefined,
        paypalStatus: result.status,
        paypalPaidAt: paidAt,
        paypalPayerEmail: result.payerEmail || undefined,
        paypalPayerName: result.payerName || undefined,
        amountSubtotal: result.subtotal ? parseFloat(result.subtotal) : undefined,
        amountTax: result.tax ? parseFloat(result.tax) : undefined,
        amountDiscount: result.discount ? parseFloat(result.discount) : undefined,
        amountShipping: result.shipping ? parseFloat(result.shipping) : undefined,
        verifiedViaApi: true,
        verifiedAt: now,
        paymentVerificationMode: "API_VERIFIED",
        paypalRaw: result.raw as unknown as Prisma.InputJsonValue,
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
          paypalInvoiceNumber: result.invoiceNumber || undefined,
          paypalTransactionId: result.transactionId || undefined,
          paypalPayerEmail: result.payerEmail || undefined,
          paypalPayerName: result.payerName || undefined,
          paypalStatus: result.status,
          paymentVerificationMode: "API_VERIFIED",
        },
      });
    }

    await logAudit(req, auth.userId, "manual_sale.invoice_verified", {
      manualSaleId: id,
      invoiceId,
      transactionId: result.transactionId,
      payerEmail: result.payerEmail,
      status: result.status,
      paid: result.paid,
      amountMismatch,
    });

    return jsonOk({
      invoiceId,
      invoiceNumber: result.invoiceNumber || null,
      transactionId: result.transactionId || null,
      payerEmail: result.payerEmail || null,
      payerName: result.payerName || null,
      status: result.status,
      paid: result.paid,
      amountDue: result.amountDue || null,
      amountPaid: result.amountPaid || null,
      currency: result.currency || null,
      paymentDate: result.paymentDate || null,
      amountMismatch,
      saleAmount: saleAmount.toFixed(2),
      verifiedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[verify-invoice]", error);
    return jsonError("Failed to verify invoice", 500);
  }
}
