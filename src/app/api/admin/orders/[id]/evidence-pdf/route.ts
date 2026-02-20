import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyChain } from "@/lib/forensic";
import { generateEvidencePdf, type EvidenceOrderData } from "@/lib/evidence-pdf";
import { jsonError } from "@/lib/api-helpers";
import { getSettings } from "@/lib/settings";

/**
 * Evidence PDF Export — generates a real PDF evidence pack for chargeback defense.
 * Uses @react-pdf/renderer for production-grade PDF generation.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return jsonError("Unauthorized", 401);

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

    const chainResult = await verifyChain(order.id);
    const generatedBy = session.user.email;

    const { storeName } = await getSettings();
    const { buffer, filename } = await generateEvidencePdf(
      order as unknown as EvidenceOrderData,
      chainResult,
      generatedBy,
      storeName,
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/orders/id/evidence-pdf]", error);
    return jsonError("Internal server error", 500);
  }
}
