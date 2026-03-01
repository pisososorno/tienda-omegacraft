import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, logAudit } from "@/lib/rbac";

const ADMIN_ROLES: ("SUPER_ADMIN" | "STORE_ADMIN")[] = ["SUPER_ADMIN", "STORE_ADMIN"];

// GET — get single manual sale detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ADMIN_ROLES });
  if (isAuthError(auth)) return auth;

  try {
    const sale = await prisma.manualSale.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, slug: true, priceUsd: true, category: true } },
        order: { select: { id: true, orderNumber: true, status: true, createdAt: true } },
        admin: { select: { id: true, name: true, email: true } },
      },
    });

    if (!sale) return jsonError("Manual sale not found", 404);

    return jsonOk({
      id: sale.id,
      status: sale.status,
      buyerEmail: sale.buyerEmailMasked,
      buyerName: sale.buyerName,
      product: sale.product,
      amount: sale.amount.toString(),
      currency: sale.currency,
      paymentMethod: sale.paymentMethod,
      paymentRef: sale.paymentRef,
      paidAt: sale.paidAt?.toISOString() || null,
      requirePaymentFirst: sale.requirePaymentFirst,
      redeemExpiresAt: sale.redeemExpiresAt.toISOString(),
      maxRedeems: sale.maxRedeems,
      redeemCount: sale.redeemCount,
      redeemedAt: sale.redeemedAt?.toISOString() || null,
      orderId: sale.orderId,
      order: sale.order,
      notes: sale.notes,
      createdBy: sale.admin,
      createdAt: sale.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[api/admin/manual-sales/id GET]", error);
    return jsonError("Internal server error", 500);
  }
}

// PUT — update manual sale (mark as paid, cancel, extend expiry)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ADMIN_ROLES });
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json();
    const { action, paymentRef, notes, redeemExpiresDays } = body;

    const sale = await prisma.manualSale.findUnique({ where: { id } });
    if (!sale) return jsonError("Manual sale not found", 404);

    switch (action) {
      case "mark_paid": {
        if (sale.status === "redeemed" || sale.status === "canceled") {
          return jsonError(`Cannot mark as paid: status is ${sale.status}`, 400);
        }
        await prisma.manualSale.update({
          where: { id },
          data: {
            status: "paid",
            paidAt: new Date(),
            paymentRef: paymentRef || sale.paymentRef,
          },
        });
        await logAudit(req, auth.userId, "manual_sale.payment_marked", {
          manualSaleId: id,
          paymentRef: paymentRef || sale.paymentRef,
        });
        return jsonOk({ success: true, status: "paid" });
      }

      case "cancel": {
        if (sale.status === "redeemed") {
          return jsonError("Cannot cancel: already redeemed", 400);
        }
        await prisma.manualSale.update({
          where: { id },
          data: { status: "canceled" },
        });
        await logAudit(req, auth.userId, "manual_sale.canceled", { manualSaleId: id });
        return jsonOk({ success: true, status: "canceled" });
      }

      case "extend_expiry": {
        const days = redeemExpiresDays || 7;
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + days);
        await prisma.manualSale.update({
          where: { id },
          data: { redeemExpiresAt: newExpiry },
        });
        await logAudit(req, auth.userId, "manual_sale.expiry_extended", {
          manualSaleId: id,
          newExpiry: newExpiry.toISOString(),
        });
        return jsonOk({ success: true, redeemExpiresAt: newExpiry.toISOString() });
      }

      case "update_notes": {
        await prisma.manualSale.update({
          where: { id },
          data: { notes: notes || null },
        });
        return jsonOk({ success: true });
      }

      default:
        return jsonError("Invalid action. Use: mark_paid, cancel, extend_expiry, update_notes", 400);
    }
  } catch (error) {
    console.error("[api/admin/manual-sales/id PUT]", error);
    return jsonError("Internal server error", 500);
  }
}

// DELETE — permanently delete a manual sale (and linked order if any)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ["SUPER_ADMIN"] });
  if (isAuthError(auth)) return auth;

  try {
    const sale = await prisma.manualSale.findUnique({
      where: { id },
      select: { id: true, orderId: true, buyerEmailMasked: true, status: true },
    });
    if (!sale) return jsonError("Manual sale not found", 404);

    // If linked order exists, delete all related records first
    if (sale.orderId) {
      await prisma.$transaction([
        prisma.orderEvent.deleteMany({ where: { orderId: sale.orderId } }),
        prisma.license.deleteMany({ where: { orderId: sale.orderId } }),
        prisma.downloadToken.deleteMany({ where: { orderId: sale.orderId } }),
        prisma.orderSnapshot.deleteMany({ where: { orderId: sale.orderId } }),
        prisma.deliveryStage.deleteMany({ where: { orderId: sale.orderId } }),
      ]);
      // Unlink order from sale before deleting
      await prisma.manualSale.update({ where: { id }, data: { orderId: null } });
      await prisma.order.delete({ where: { id: sale.orderId } });
    }

    await prisma.manualSale.delete({ where: { id } });

    await logAudit(req, auth.userId, "manual_sale.deleted", {
      manualSaleId: id,
      hadOrder: !!sale.orderId,
      buyerEmailMasked: sale.buyerEmailMasked,
      status: sale.status,
    });

    return jsonOk({ success: true, deleted: true });
  } catch (error) {
    console.error("[api/admin/manual-sales/id DELETE]", error);
    return jsonError("Internal server error", 500);
  }
}
