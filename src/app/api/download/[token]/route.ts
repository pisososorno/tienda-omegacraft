import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/forensic";
import { verifyDownloadToken, hashToken } from "@/lib/tokens";
import { downloadFileStream, headFile } from "@/lib/storage";
import { getClientIp, getUserAgent } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const rawToken = token;
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  const rangeHeader = req.headers.get("range") || undefined;

  // 1. Verify token signature + expiry
  const payload = verifyDownloadToken(rawToken);
  if (!payload) {
    return new Response("Invalid or expired download link", { status: 403 });
  }

  const tokenHash = hashToken(rawToken);

  // 2. Find token in DB
  const downloadToken = await prisma.downloadToken.findFirst({
    where: { tokenHash },
  });

  if (!downloadToken) {
    return new Response("Download token not found", { status: 404 });
  }

  // 3. Load order with product
  const order = await prisma.order.findUnique({
    where: { id: downloadToken.orderId },
    include: { product: { include: { files: { orderBy: { sortOrder: "asc" } } } } },
  });

  if (!order) {
    return new Response("Order not found", { status: 404 });
  }

  // 4. Check order status — frozen orders cannot be downloaded
  if (order.status === "frozen") {
    await appendEvent({
      orderId: order.id,
      eventType: "download.denied_frozen",
      eventData: { tokenHashPrefix: tokenHash.substring(0, 8), result: "DENIED_FROZEN" },
      ipAddress: ip,
      userAgent: ua,
    });
    return new Response("Downloads are frozen for this order", { status: 403 });
  }

  // 5. Check if downloads are revoked
  if (order.downloadsRevoked) {
    await appendEvent({
      orderId: order.id,
      eventType: "download.denied",
      eventData: { tokenHashPrefix: tokenHash.substring(0, 8), result: "DENIED_REVOKED" },
      ipAddress: ip,
      userAgent: ua,
    });
    return new Response("Downloads have been revoked", { status: 403 });
  }

  // 6. Check download expiry
  if (order.downloadsExpireAt && new Date() > order.downloadsExpireAt) {
    await appendEvent({
      orderId: order.id,
      eventType: "download.denied",
      eventData: { tokenHashPrefix: tokenHash.substring(0, 8), result: "DENIED_EXPIRED" },
      ipAddress: ip,
      userAgent: ua,
    });
    return new Response("Download period has expired", { status: 410 });
  }

  // 7. Check if token already used
  if (downloadToken.used) {
    await appendEvent({
      orderId: order.id,
      eventType: "download.denied",
      eventData: { tokenHashPrefix: tokenHash.substring(0, 8), result: "DENIED_TOKEN_USED" },
      ipAddress: ip,
      userAgent: ua,
    });
    return new Response("This download link has already been used", { status: 410 });
  }

  // 8. Check download limit
  if (order.downloadCount >= order.downloadLimit) {
    await appendEvent({
      orderId: order.id,
      eventType: "download.denied",
      eventData: {
        tokenHashPrefix: tokenHash.substring(0, 8),
        result: "DENIED_LIMIT_REACHED",
        downloadCount: order.downloadCount,
        downloadLimit: order.downloadLimit,
      },
      ipAddress: ip,
      userAgent: ua,
    });
    return new Response("Download limit reached", { status: 429 });
  }

  // 9. Determine which file to serve
  let storageKey: string;
  let filename: string;

  if (downloadToken.stageId) {
    // Staged delivery
    const stage = await prisma.deliveryStage.findUnique({
      where: { id: downloadToken.stageId },
    });
    if (!stage || !stage.storageKey || stage.status === "revoked") {
      await appendEvent({
        orderId: order.id,
        eventType: "download.denied",
        eventData: { tokenHashPrefix: tokenHash.substring(0, 8), result: "DENIED_STAGE_UNAVAILABLE" },
        ipAddress: ip,
        userAgent: ua,
      });
      return new Response("Stage not available", { status: 404 });
    }
    if (stage.status !== "ready" && stage.status !== "delivered") {
      await appendEvent({
        orderId: order.id,
        eventType: "download.denied",
        eventData: { tokenHashPrefix: tokenHash.substring(0, 8), result: "DENIED_STAGE_NOT_RELEASED" },
        ipAddress: ip,
        userAgent: ua,
      });
      return new Response("This stage has not been released yet", { status: 403 });
    }
    storageKey = stage.storageKey;
    filename = stage.filename || "download";
  } else {
    // Non-staged: serve primary file or delivery package
    if (order.deliveryPackageKey) {
      storageKey = order.deliveryPackageKey;
      filename = `${order.orderNumber}-delivery.zip`;
    } else if (order.product.files.length > 0) {
      storageKey = order.product.files[0].storageKey;
      filename = order.product.files[0].filename;
    } else {
      return new Response("No files available", { status: 404 });
    }
  }

  // 10. Stream file from S3/R2 with Range support
  const fileData = await downloadFileStream(storageKey, rangeHeader);
  if (!fileData) {
    await appendEvent({
      orderId: order.id,
      eventType: "download.denied",
      eventData: { tokenHashPrefix: tokenHash.substring(0, 8), result: "DENIED_FILE_NOT_FOUND", storageKey },
      ipAddress: ip,
      userAgent: ua,
    });
    return new Response("File not found in storage", { status: 404 });
  }

  // 11. Mark token as used + increment download count (only on non-Range or first Range request)
  const isResumeRequest = !!rangeHeader;
  if (!isResumeRequest) {
    await prisma.$transaction([
      prisma.downloadToken.update({
        where: { id: downloadToken.id },
        data: { used: true },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { downloadCount: { increment: 1 } },
      }),
    ]);

    // Update stage download count if staged
    if (downloadToken.stageId) {
      await prisma.deliveryStage.update({
        where: { id: downloadToken.stageId },
        data: {
          downloadCount: { increment: 1 },
          status: "delivered",
        },
      });
    }
  }

  // 12. Log successful download
  await appendEvent({
    orderId: order.id,
    eventType: "download.completed",
    eventData: {
      tokenHashPrefix: tokenHash.substring(0, 8),
      result: isResumeRequest ? "OK_RANGE" : "OK",
      filename,
      storageKey,
      stageId: downloadToken.stageId || null,
      contentLength: fileData.contentLength,
      rangeRequested: rangeHeader || null,
    },
    ipAddress: ip,
    userAgent: ua,
  });

  // 13. Build response headers
  const responseHeaders: Record<string, string> = {
    "Content-Type": fileData.contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (fileData.contentLength) {
    responseHeaders["Content-Length"] = String(fileData.contentLength);
  }
  if (fileData.contentRange) {
    responseHeaders["Content-Range"] = fileData.contentRange;
  }
  responseHeaders["Accept-Ranges"] = "bytes";

  // 14. Stream response
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
    status: fileData.statusCode,
    headers: responseHeaders,
  });
}
