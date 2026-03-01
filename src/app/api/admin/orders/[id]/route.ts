import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyChain } from "@/lib/forensic";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ALL, verifyOrderOwnership, isSeller, logAudit } from "@/lib/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  // SELLER: verify ownership
  if (isSeller(auth)) {
    const owns = await verifyOrderOwnership(auth, id);
    if (!owns) return jsonError("Order not found", 404);
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: true,
        termsVersion: { select: { versionLabel: true, contentHash: true } },
        events: { orderBy: { sequenceNumber: "asc" } },
        downloadTokens: { orderBy: { createdAt: "desc" }, take: 20 },
        license: true,
        snapshots: { orderBy: { createdAt: "asc" } },
        deliveryStages: { orderBy: { stageOrder: "asc" } },
        evidenceAttachments: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!order) return jsonError("Order not found", 404);

    // SELLER: minimal payload (no forensic, paypal, buyer PII)
    if (isSeller(auth)) {
      return jsonOk({
        id: order.id,
        orderNumber: order.orderNumber,
        amountUsd: order.amountUsd.toString(),
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        product: {
          id: order.product.id,
          name: order.product.name,
          category: order.product.category,
        },
      });
    }

    // ADMIN: full payload
    const chainIntegrity = await verifyChain(order.id);

    return jsonOk({
      id: order.id,
      orderNumber: order.orderNumber,
      buyerEmail: order.buyerEmail,
      buyerIp: order.buyerIp,
      buyerUserAgent: order.buyerUserAgent,
      buyerCountry: order.buyerCountry,
      buyerCity: order.buyerCity,
      amountUsd: order.amountUsd.toString(),
      currency: order.currency,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentReferenceUrl: order.paymentReferenceUrl,
      paypalOrderId: order.paypalOrderId,
      paypalCaptureId: order.paypalCaptureId,
      paypalPayerId: order.paypalPayerId,
      paypalPayerEmail: order.paypalPayerEmail,
      paypalStatus: order.paypalStatus,
      paypalInvoiceId: order.paypalInvoiceId,
      paypalInvoiceNumber: order.paypalInvoiceNumber,
      paypalTransactionId: order.paypalTransactionId,
      downloadCount: order.downloadCount,
      downloadLimit: order.downloadLimit,
      downloadsExpireAt: order.downloadsExpireAt?.toISOString() || null,
      downloadsRevoked: order.downloadsRevoked,
      termsAcceptedAt: order.termsAcceptedAt.toISOString(),
      termsAcceptedIp: order.termsAcceptedIp,
      termsVersion: order.termsVersion,
      evidenceFrozenAt: order.evidenceFrozenAt?.toISOString() || null,
      evidenceFrozenByAdmin: order.evidenceFrozenByAdmin,
      frozenEvidencePdfKey: order.frozenEvidencePdfKey,
      retentionExpiresAt: order.retentionExpiresAt?.toISOString() || null,
      createdAt: order.createdAt.toISOString(),
      product: {
        id: order.product.id,
        name: order.product.name,
        slug: order.product.slug,
        category: order.product.category,
        priceUsd: order.product.priceUsd.toString(),
      },
      license: order.license
        ? {
            licenseKey: order.license.licenseKey,
            fingerprint: order.license.fingerprint,
            status: order.license.status,
          }
        : null,
      events: order.events.map((e) => ({
        id: e.id,
        sequenceNumber: e.sequenceNumber,
        eventType: e.eventType,
        eventData: e.eventData,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent?.substring(0, 100),
        externalRef: e.externalRef,
        prevHash: e.prevHash,
        eventHash: e.eventHash,
        createdAt: e.createdAt.toISOString(),
      })),
      snapshots: order.snapshots.map((s) => ({
        id: s.id,
        snapshotType: s.snapshotType,
        snapshotHash: s.snapshotHash,
        snapshotHtmlKey: s.snapshotHtmlKey,
        snapshotPdfKey: s.snapshotPdfKey,
        createdAt: s.createdAt.toISOString(),
      })),
      stages: order.deliveryStages.map((st) => ({
        id: st.id,
        stageType: st.stageType,
        stageOrder: st.stageOrder,
        status: st.status,
        filename: st.filename,
        fileSize: st.fileSize?.toString() || null,
        sha256Hash: st.sha256Hash,
        downloadCount: st.downloadCount,
        downloadLimit: st.downloadLimit,
        releasedAt: st.releasedAt?.toISOString() || null,
        createdAt: st.createdAt.toISOString(),
      })),
      evidenceAttachments: order.evidenceAttachments.map((a) => ({
        id: a.id,
        type: a.type,
        filename: a.filename,
        fileSize: a.fileSize.toString(),
        sha256Hash: a.sha256Hash,
        mimeType: a.mimeType,
        description: a.description,
        createdAt: a.createdAt.toISOString(),
      })),
      chainIntegrity,
    });
  } catch (error) {
    console.error("[admin/orders/id]", error);
    return jsonError("Internal server error", 500);
  }
}

// DELETE — permanently delete an order and all related records
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ["SUPER_ADMIN"] });
  if (isAuthError(auth)) return auth;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, buyerEmail: true, status: true },
    });
    if (!order) return jsonError("Order not found", 404);

    // Unlink any manual sale referencing this order
    await prisma.manualSale.updateMany({
      where: { orderId: id },
      data: { orderId: null },
    });

    // Delete all related records
    await prisma.$transaction([
      prisma.orderEvent.deleteMany({ where: { orderId: id } }),
      prisma.license.deleteMany({ where: { orderId: id } }),
      prisma.downloadToken.deleteMany({ where: { orderId: id } }),
      prisma.orderSnapshot.deleteMany({ where: { orderId: id } }),
      prisma.deliveryStage.deleteMany({ where: { orderId: id } }),
      prisma.paymentEvidenceAttachment.deleteMany({ where: { orderId: id } }),
    ]);

    // Delete the order
    await prisma.order.delete({ where: { id } });

    await logAudit(req, auth.userId, "order.deleted", {
      orderId: id,
      orderNumber: order.orderNumber,
      status: order.status,
    });

    return jsonOk({ success: true, deleted: true, orderNumber: order.orderNumber });
  } catch (error) {
    console.error("[admin/orders/id DELETE]", error);
    return jsonError("Internal server error", 500);
  }
}
