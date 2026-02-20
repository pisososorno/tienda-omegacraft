import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyChain } from "@/lib/forensic";
import { maskIp } from "@/lib/privacy";
import { jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

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
      },
    });

    if (!order) return jsonError("Order not found", 404);

    // Verify chain integrity
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
      paypalOrderId: order.paypalOrderId,
      paypalCaptureId: order.paypalCaptureId,
      paypalPayerId: order.paypalPayerId,
      paypalPayerEmail: order.paypalPayerEmail,
      paypalStatus: order.paypalStatus,
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
      chainIntegrity,
    });
  } catch (error) {
    console.error("[admin/orders/id]", error);
    return jsonError("Internal server error", 500);
  }
}
