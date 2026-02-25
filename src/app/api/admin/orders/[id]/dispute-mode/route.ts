import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth, isAuthError, ROLES_ADMIN } from "@/lib/rbac";
import { appendEvent, verifyChain } from "@/lib/forensic";
import { generateEvidencePdf, type EvidenceOrderData } from "@/lib/evidence-pdf";
import { uploadFile } from "@/lib/storage";
import { sha256Buffer } from "@/lib/hashing";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getSettings } from "@/lib/settings";

/**
 * Dispute Mode — Freeze evidence, generate PDF, upload to S3/R2, revoke downloads.
 *
 * Flow:
 * 1. Validate order exists and is not already frozen.
 * 2. Verify event chain integrity.
 * 3. Freeze order (status=frozen, evidenceFrozenAt, evidenceFrozenByAdmin).
 * 4. Log admin.dispute_mode_activated event.
 * 5. Revoke downloads + log admin.downloads_revoked event.
 * 6. Generate frozen evidence PDF (includes all events up to this point).
 * 7. Upload PDF to S3/R2.
 * 8. Save frozenEvidencePdfKey on the order.
 * 9. Log admin.evidence_pdf_generated event.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ADMIN });
  if (isAuthError(auth)) return auth;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: true,
        termsVersion: true,
        events: { orderBy: { sequenceNumber: "asc" } },
        license: true,
        snapshots: { orderBy: { createdAt: "asc" } },
        deliveryStages: { orderBy: { stageOrder: "asc" } },
      },
    });

    if (!order) return jsonError("Order not found", 404);

    if (order.evidenceFrozenAt) {
      return jsonError("Evidence already frozen for this order", 409);
    }

    // 1. Verify chain integrity BEFORE freezing
    const chainResult = await verifyChain(order.id);

    const now = new Date();
    const adminEmail = auth.email;

    // 2. Freeze order + revoke downloads atomically
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "frozen",
        evidenceFrozenAt: now,
        evidenceFrozenByAdmin: adminEmail,
        downloadsRevoked: true,
      },
    });

    // 3. Log dispute mode activation event
    await appendEvent({
      orderId: order.id,
      eventType: "admin.dispute_mode_activated",
      eventData: {
        activatedBy: adminEmail,
        previousStatus: order.status,
        frozenAt: now.toISOString(),
        chainValid: chainResult.valid,
        chainTotalEvents: chainResult.totalEvents,
      },
    });

    // 4. Log downloads revoked event
    await appendEvent({
      orderId: order.id,
      eventType: "admin.downloads_revoked",
      eventData: {
        reason: "dispute_mode_activation",
        revokedBy: adminEmail,
      },
    });

    // 5. Re-fetch order with the new events included in the PDF
    const orderForPdf = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        product: true,
        termsVersion: true,
        events: { orderBy: { sequenceNumber: "asc" } },
        license: true,
        snapshots: { orderBy: { createdAt: "asc" } },
        deliveryStages: { orderBy: { stageOrder: "asc" } },
      },
    });

    if (!orderForPdf) return jsonError("Order not found after update", 500);

    // 6. Re-verify chain (now includes the new events)
    const finalChainResult = await verifyChain(order.id);

    // 7. Generate frozen evidence PDF
    const { storeName } = await getSettings();
    const { buffer, filename, documentId } = await generateEvidencePdf(
      orderForPdf as unknown as EvidenceOrderData,
      finalChainResult,
      adminEmail,
      storeName,
    );

    // 8. Upload PDF to S3/R2
    const pdfHash = sha256Buffer(buffer);
    const storageKey = `evidence/${order.orderNumber}/${filename}`;
    await uploadFile(storageKey, buffer, "application/pdf");

    // 9. Save frozenEvidencePdfKey on the order
    await prisma.order.update({
      where: { id: order.id },
      data: { frozenEvidencePdfKey: storageKey },
    });

    // 10. Log evidence PDF generated event
    await appendEvent({
      orderId: order.id,
      eventType: "admin.evidence_pdf_generated",
      eventData: {
        documentId,
        storageKey,
        pdfHash,
        pdfSizeBytes: buffer.length,
        chainValid: finalChainResult.valid,
        generatedBy: adminEmail,
      },
    });

    return jsonOk({
      success: true,
      evidenceFrozenAt: now.toISOString(),
      frozenBy: adminEmail,
      chainValid: finalChainResult.valid,
      chainTotalEvents: finalChainResult.totalEvents,
      frozenEvidencePdfKey: storageKey,
      pdfHash,
      pdfSizeBytes: buffer.length,
      documentId,
      message: "Dispute mode activated. Evidence frozen. PDF generated and uploaded. Downloads revoked.",
    });
  } catch (error) {
    console.error("[admin/orders/id/dispute-mode]", error);
    return jsonError("Internal server error", 500);
  }
}
