import { NextRequest } from "next/server";
import { Readable } from "stream";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import Busboy from "busboy";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ALL, verifyProductOwnership, isSeller } from "@/lib/rbac";
import { uploadFile, deleteFile } from "@/lib/storage";

// ── Debug logger (writes to upload-debug.log) ────────
const LOG_PATH = path.join(process.env.UPLOADS_DIR || process.cwd(), "upload-debug.log");
function logUpload(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try { fs.appendFileSync(LOG_PATH, line); } catch { /* ignore */ }
  console.log(`[upload-debug] ${msg}`);
}

// Allow large file uploads
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for large uploads

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const ALLOWED_EXTENSIONS = [
  ".zip", ".rar", ".7z", ".tar.gz", ".gz",
  ".jar", ".sk", ".yml", ".yaml", ".json",
  ".schematic", ".schem", ".nbt", ".litematic",
  ".mcworld", ".mcpack", ".mcaddon",
  ".png", ".jpg", ".txt", ".md", ".pdf",
];

interface ParsedFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  sha256Hash: string;
  size: number;
}

/**
 * Parse multipart form data using busboy (streaming).
 * This drains the socket continuously, preventing TCP backpressure
 * that would stall XHR upload progress events in the browser.
 */
function parseMultipart(req: NextRequest): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") || "";
    logUpload(`parseMultipart START — content-type: ${contentType.substring(0, 80)}`);
    if (!contentType.includes("multipart/form-data")) {
      return reject(new Error("Expected multipart/form-data"));
    }

    const bb = Busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    });

    let fileFound = false;

    bb.on("file", (_fieldname: string, stream: Readable, info: { filename: string; mimeType: string }) => {
      fileFound = true;
      const { filename, mimeType } = info;
      logUpload(`busboy FILE event: ${filename} (${mimeType})`);
      const chunks: Buffer[] = [];
      const hash = crypto.createHash("sha256");
      let size = 0;
      let chunkCount = 0;
      let limitExceeded = false;
      const startTime = Date.now();

      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        chunkCount++;
        if (chunkCount % 100 === 0 || chunkCount <= 3) {
          logUpload(`  chunk #${chunkCount}: +${chunk.length}B, total=${size}B (${(size / 1024 / 1024).toFixed(1)}MB)`);
        }
        if (size > MAX_FILE_SIZE) {
          limitExceeded = true;
          stream.destroy();
          return;
        }
        chunks.push(chunk);
        hash.update(chunk);
      });

      stream.on("end", () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logUpload(`busboy stream END: ${chunkCount} chunks, ${(size / 1024 / 1024).toFixed(1)}MB in ${elapsed}s`);
        if (limitExceeded) {
          return reject(new Error(`File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`));
        }
        resolve({
          filename,
          mimeType: mimeType || "application/octet-stream",
          buffer: Buffer.concat(chunks),
          sha256Hash: hash.digest("hex"),
          size,
        });
      });

      stream.on("error", (err) => {
        logUpload(`busboy stream ERROR: ${err.message}`);
        reject(err);
      });
    });

    bb.on("error", (err: Error) => {
      logUpload(`busboy ERROR: ${err.message}`);
      reject(err);
    });
    bb.on("close", () => {
      logUpload(`busboy CLOSE — fileFound=${fileFound}`);
      if (!fileFound) reject(new Error("No file provided"));
    });

    // Pipe the request body into busboy to start streaming
    const body = req.body;
    if (!body) {
      logUpload("ERROR: No request body");
      return reject(new Error("No request body"));
    }
    logUpload("Piping request body → busboy...");
    const nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream);
    nodeStream.on("error", (err) => logUpload(`nodeStream ERROR: ${err.message}`));
    nodeStream.pipe(bb);
  });
}

// GET — list files for a product
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  if (isSeller(auth)) {
    const owns = await verifyProductOwnership(auth, id);
    if (!owns) return jsonError("Product not found", 404);
  }

  const files = await prisma.productFile.findMany({
    where: { productId: id },
    orderBy: { sortOrder: "asc" },
  });

  return jsonOk(
    files.map((f: { id: string; filename: string; storageKey: string; fileSize: bigint; sha256Hash: string; mimeType: string; sortOrder: number; isPrimary: boolean }) => ({
      ...f,
      fileSize: f.fileSize.toString(),
    }))
  );
}

// POST — upload a new file for a product (streaming via busboy)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ALL, requireActiveSeller: true });
  if (isAuthError(auth)) return auth;

  // Verify product exists + ownership
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return jsonError("Product not found", 404);
  if (isSeller(auth) && product.sellerId !== auth.sellerId) return jsonError("Product not found", 404);

  try {
    logUpload(`POST /files — productId=${id}, auth OK, starting parse...`);

    // Stream-parse multipart data (prevents TCP backpressure → XHR progress works)
    const file = await parseMultipart(req);
    logUpload(`Parse complete: ${file.filename}, ${(file.size / 1024 / 1024).toFixed(1)}MB, hash=${file.sha256Hash.substring(0, 12)}`);

    // Validate extension
    const ext = "." + file.filename.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((e) => file.filename.toLowerCase().endsWith(e))) {
      logUpload(`Extension rejected: ${ext}`);
      return jsonError(`Extension not allowed: ${ext}`, 400);
    }

    // Generate storage key
    const timestamp = Date.now();
    const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `products/${id}/${timestamp}-${safeFilename}`;

    // Upload to storage (S3 or local)
    logUpload(`Uploading to storage: ${storageKey}...`);
    await uploadFile(storageKey, file.buffer, file.mimeType);
    logUpload(`Storage upload done.`);

    // Count existing files for sort order
    const existingCount = await prisma.productFile.count({ where: { productId: id } });

    // Create DB record
    logUpload(`Creating DB record...`);
    const productFile = await prisma.productFile.create({
      data: {
        productId: id,
        filename: file.filename,
        storageKey: storageKey,
        fileSize: BigInt(file.size),
        sha256Hash: file.sha256Hash,
        mimeType: file.mimeType,
        sortOrder: existingCount,
        isPrimary: existingCount === 0,
      },
    });

    logUpload(`SUCCESS: ${productFile.filename} (${productFile.id}) — upload complete.`);
    return jsonOk({
      id: productFile.id,
      filename: productFile.filename,
      fileSize: productFile.fileSize.toString(),
      sha256Hash: productFile.sha256Hash,
      mimeType: productFile.mimeType,
      sortOrder: productFile.sortOrder,
      isPrimary: productFile.isPrimary,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error uploading file";
    logUpload(`FAIL: ${msg}`);
    console.error("[api/admin/products/files POST]", error);
    return jsonError(msg, 500);
  }
}

// DELETE — remove a file
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await withAdminAuth(req, { roles: ROLES_ALL, requireActiveSeller: true });
  if (isAuthError(auth)) return auth;

  if (isSeller(auth)) {
    const owns = await verifyProductOwnership(auth, id);
    if (!owns) return jsonError("Product not found", 404);
  }

  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("fileId");
  if (!fileId) return jsonError("fileId required", 400);

  const file = await prisma.productFile.findFirst({
    where: { id: fileId, productId: id },
  });

  if (!file) return jsonError("File not found", 404);

  // Delete from storage
  try {
    await deleteFile(file.storageKey);
  } catch (err) {
    console.error("[api/admin/products/files DELETE] Storage error:", err);
  }

  // Delete DB record
  await prisma.productFile.delete({ where: { id: fileId } });

  return jsonOk({ success: true });
}
