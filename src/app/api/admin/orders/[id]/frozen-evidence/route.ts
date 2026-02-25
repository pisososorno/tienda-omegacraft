import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth, isAuthError, ROLES_ADMIN } from "@/lib/rbac";
import { downloadFileStream } from "@/lib/storage";
import { jsonError } from "@/lib/api-helpers";

/**
 * Frozen Evidence PDF — Stream the immutable evidence PDF from S3/R2.
 * Only accessible by authenticated admin users.
 * The PDF was generated and uploaded during dispute-mode activation.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ADMIN });
  if (isAuthError(auth)) return auth;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        orderNumber: true,
        frozenEvidencePdfKey: true,
        evidenceFrozenAt: true,
      },
    });

    if (!order) return jsonError("Order not found", 404);

    if (!order.frozenEvidencePdfKey) {
      return jsonError(
        "No frozen evidence PDF available. Activate dispute mode first.",
        404,
      );
    }

    const fileData = await downloadFileStream(order.frozenEvidencePdfKey);

    if (!fileData) {
      return jsonError("Frozen evidence PDF not found in storage", 404);
    }

    const filename = order.frozenEvidencePdfKey.split("/").pop()
      || `evidence-${order.orderNumber}-frozen.pdf`;

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of fileData.stream as AsyncIterable<Uint8Array>) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(fileData.contentLength),
        "Cache-Control": "no-store",
        "X-Evidence-Frozen-At": order.evidenceFrozenAt?.toISOString() || "",
      },
    });
  } catch (error) {
    console.error("[admin/orders/id/frozen-evidence]", error);
    return jsonError("Internal server error", 500);
  }
}
