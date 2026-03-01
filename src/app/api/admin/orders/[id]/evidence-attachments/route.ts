import { NextRequest } from "next/server";
import { Readable } from "stream";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import Busboy from "busboy";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ADMIN } from "@/lib/rbac";
import { uploadFile, deleteFile } from "@/lib/storage";
import { logAudit } from "@/lib/rbac";
import { appendEvent } from "@/lib/forensic";

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20 MB per attachment
const ALLOWED_MIME_TYPES = [
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/pdf",
  "text/html", "text/plain",
];

interface ParsedAttachment {
  tempPath: string;
  filename: string;
  mimeType: string;
  sha256Hash: string;
  size: number;
}

function getTempDir(): string {
  const base = process.env.UPLOADS_DIR || os.tmpdir();
  return path.join(base, "tmp");
}

function parseAttachmentUpload(req: NextRequest): Promise<{ file: ParsedAttachment; description: string; type: string }> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return reject(new Error("Expected multipart/form-data"));
    }

    const bb = Busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 1, fields: 5 },
    });

    let fileResult: ParsedAttachment | null = null;
    let description = "";
    let type = "screenshot";
    let settled = false;

    function finish(err: Error): void;
    function finish(result: { file: ParsedAttachment; description: string; type: string }): void;
    function finish(v: Error | { file: ParsedAttachment; description: string; type: string }) {
      if (settled) return;
      settled = true;
      if (v instanceof Error) reject(v);
      else resolve(v);
    }

    bb.on("field", (name: string, val: string) => {
      if (name === "description") description = val;
      if (name === "type") type = val;
    });

    bb.on("file", (_fieldname: string, stream: Readable, info: { filename: string; mimeType: string }) => {
      const { filename, mimeType } = info;

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        stream.resume(); // drain
        return finish(new Error(`File type not allowed: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`));
      }

      const tmpDir = getTempDir();
      fs.mkdirSync(tmpDir, { recursive: true });
      const tempPath = path.join(tmpDir, `attach-${Date.now()}-${Math.random().toString(36).slice(2)}`);

      const hash = crypto.createHash("sha256");
      const ws = fs.createWriteStream(tempPath);
      let size = 0;
      let limitHit = false;

      stream.on("limit", () => {
        limitHit = true;
        ws.destroy();
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
        finish(new Error(`Attachment too large. Max ${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB`));
      });

      stream.on("data", (chunk: Buffer) => {
        if (limitHit) return;
        size += chunk.length;
        hash.update(chunk);
        ws.write(chunk);
      });

      stream.on("end", () => {
        if (limitHit) return;
        ws.end(() => {
          fileResult = {
            tempPath,
            filename,
            mimeType,
            sha256Hash: hash.digest("hex"),
            size,
          };
        });
      });

      stream.on("error", (err) => {
        ws.destroy();
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
        finish(err);
      });
    });

    bb.on("error", (err: Error) => finish(err));
    bb.on("close", () => {
      if (!fileResult) return finish(new Error("No file provided"));
      finish({ file: fileResult, description, type });
    });

    const body = req.body;
    if (!body) return finish(new Error("No request body"));
    const nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream);
    nodeStream.pipe(bb);
  });
}

// GET — list evidence attachments for an order
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ADMIN });
  if (isAuthError(auth)) return auth;

  const attachments = await prisma.paymentEvidenceAttachment.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "asc" },
    include: { admin: { select: { name: true, email: true } } },
  });

  return jsonOk(
    attachments.map((a) => ({
      id: a.id,
      type: a.type,
      filename: a.filename,
      fileSize: a.fileSize.toString(),
      sha256Hash: a.sha256Hash,
      mimeType: a.mimeType,
      description: a.description,
      createdBy: a.admin,
      createdAt: a.createdAt.toISOString(),
    }))
  );
}

// POST — upload a new evidence attachment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ADMIN });
  if (isAuthError(auth)) return auth;

  // Verify order exists
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, orderNumber: true } });
  if (!order) return jsonError("Order not found", 404);

  let tempPath: string | null = null;

  try {
    const { file, description, type } = await parseAttachmentUpload(req);
    tempPath = file.tempPath;

    // Upload to storage
    const storageKey = `evidence/${order.orderNumber}/${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const fileStream = fs.createReadStream(tempPath);
    await uploadFile(storageKey, fileStream, file.mimeType);

    // Create DB record
    const attachment = await prisma.paymentEvidenceAttachment.create({
      data: {
        orderId: id,
        type,
        filename: file.filename,
        storageKey,
        fileSize: BigInt(file.size),
        sha256Hash: file.sha256Hash,
        mimeType: file.mimeType,
        description: description || null,
        createdByAdminId: auth.userId,
      },
    });

    // Log forensic event
    await appendEvent({
      orderId: id,
      eventType: "admin.evidence_attached",
      eventData: {
        attachmentId: attachment.id,
        filename: file.filename,
        type,
        fileSize: file.size,
        sha256Hash: file.sha256Hash,
        mimeType: file.mimeType,
        description: description || null,
        uploadedBy: auth.email,
      },
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
      userAgent: req.headers.get("user-agent") || undefined,
    });

    await logAudit(req, auth.userId, "evidence_attachment.uploaded", {
      orderId: id,
      attachmentId: attachment.id,
      filename: file.filename,
    });

    return jsonOk({
      id: attachment.id,
      type: attachment.type,
      filename: attachment.filename,
      fileSize: attachment.fileSize.toString(),
      sha256Hash: attachment.sha256Hash,
      mimeType: attachment.mimeType,
      description: attachment.description,
      createdAt: attachment.createdAt.toISOString(),
    }, 201);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error uploading attachment";
    console.error("[evidence-attachments POST]", error);
    return jsonError(msg, 500);
  } finally {
    if (tempPath) {
      fs.promises.unlink(tempPath).catch(() => { /* ignore */ });
    }
  }
}

// DELETE — remove an evidence attachment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ADMIN });
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const attachmentId = searchParams.get("attachmentId");
  if (!attachmentId) return jsonError("attachmentId required", 400);

  const attachment = await prisma.paymentEvidenceAttachment.findFirst({
    where: { id: attachmentId, orderId: id },
  });
  if (!attachment) return jsonError("Attachment not found", 404);

  // Delete from storage
  try {
    await deleteFile(attachment.storageKey);
  } catch (err) {
    console.error("[evidence-attachments DELETE] Storage error:", err);
  }

  await prisma.paymentEvidenceAttachment.delete({ where: { id: attachmentId } });

  await logAudit(req, auth.userId, "evidence_attachment.deleted", {
    orderId: id,
    attachmentId,
    filename: attachment.filename,
  });

  return jsonOk({ success: true });
}
