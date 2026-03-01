import { NextRequest } from "next/server";
import { Readable } from "stream";
import crypto from "crypto";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
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
export const dynamic = "force-dynamic";
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
  tempPath: string;      // temp file on disk (NOT in RAM)
  filename: string;
  mimeType: string;
  sha256Hash: string;
  size: number;
}

/**
 * Get the temp directory for uploads — uses UPLOADS_DIR/tmp if available,
 * else falls back to OS temp.
 */
function getTempDir(): string {
  const base = process.env.UPLOADS_DIR || os.tmpdir();
  return path.join(base, "tmp");
}

/**
 * Parse multipart form data using busboy.
 * Streams the file to disk (createWriteStream) — no RAM buffer.
 * Computes sha256 incrementally during streaming.
 */
function parseMultipart(req: NextRequest): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") || "";
    logUpload(`parseMultipart START — content-type: ${contentType.substring(0, 100)}`);
    if (!contentType.includes("multipart/form-data")) {
      return reject(new Error("Expected multipart/form-data"));
    }

    // Busboy limits: 600MB fileSize (slightly over our 500MB UI limit for safety)
    const bb = Busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: 600 * 1024 * 1024, files: 1 },
    });

    let fileFound = false;
    let settled = false;

    function finish(err: Error): void;
    function finish(result: ParsedFile): void;
    function finish(errOrResult: Error | ParsedFile) {
      if (settled) return;
      settled = true;
      if (errOrResult instanceof Error) reject(errOrResult);
      else resolve(errOrResult);
    }

    bb.on("file", (_fieldname: string, stream: Readable, info: { filename: string; mimeType: string }) => {
      fileFound = true;
      const { filename, mimeType } = info;
      logUpload(`busboy FILE event: "${filename}" (${mimeType})`);

      const tmpDir = getTempDir();
      fs.mkdirSync(tmpDir, { recursive: true });
      const tempPath = path.join(tmpDir, `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`);

      const hash = crypto.createHash("sha256");
      const ws = fs.createWriteStream(tempPath);
      let size = 0;
      let chunkCount = 0;
      let limitHit = false;
      const startTime = Date.now();

      // Handle busboy's built-in limit event (fileSize exceeded)
      stream.on("limit", () => {
        limitHit = true;
        logUpload(`LIMIT_REACHED: "${filename}" at ${(size / 1024 / 1024).toFixed(1)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
        ws.destroy();
        // Clean up temp file
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
        finish(new Error("FILE_TOO_LARGE"));
      });

      stream.on("data", (chunk: Buffer) => {
        if (limitHit) return;
        size += chunk.length;
        chunkCount++;
        if (chunkCount % 500 === 0 || chunkCount <= 3) {
          logUpload(`  chunk #${chunkCount}: +${chunk.length}B, total=${(size / 1024 / 1024).toFixed(1)}MB`);
        }
        // Secondary size guard (in case busboy limit is set higher)
        if (size > MAX_FILE_SIZE) {
          limitHit = true;
          logUpload(`LIMIT_REACHED (secondary): "${filename}" at ${(size / 1024 / 1024).toFixed(1)}MB`);
          stream.destroy();
          ws.destroy();
          try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
          finish(new Error("FILE_TOO_LARGE"));
          return;
        }
        hash.update(chunk);
        ws.write(chunk);
      });

      stream.on("end", () => {
        if (limitHit) return;
        ws.end(() => {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          logUpload(`busboy stream END: ${chunkCount} chunks, ${(size / 1024 / 1024).toFixed(1)}MB in ${elapsed}s → ${tempPath}`);
          finish({
            tempPath,
            filename,
            mimeType: mimeType || "application/octet-stream",
            sha256Hash: hash.digest("hex"),
            size,
          });
        });
      });

      stream.on("error", (err) => {
        logUpload(`busboy stream ERROR: ${err.message}`);
        ws.destroy();
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
        finish(err);
      });

      ws.on("error", (err) => {
        logUpload(`writeStream ERROR: ${err.message}`);
        stream.destroy();
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
        finish(err);
      });
    });

    bb.on("error", (err: Error) => {
      logUpload(`busboy ERROR: ${err.message}`);
      finish(err);
    });
    bb.on("close", () => {
      logUpload(`busboy CLOSE — fileFound=${fileFound}`);
      if (!fileFound) finish(new Error("No file provided"));
    });

    // Pipe the request body into busboy
    const body = req.body;
    if (!body) {
      logUpload("ERROR: No request body");
      return finish(new Error("No request body"));
    }
    logUpload("Piping request body → busboy...");
    const nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream);
    nodeStream.on("error", (err) => {
      logUpload(`nodeStream ERROR: ${err.message}`);
      finish(err);
    });
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

  let tempPath: string | null = null;

  try {
    logUpload(`POST /files — productId=${id}, auth OK, starting parse...`);

    // Stream-parse multipart data to temp file (no RAM buffer)
    const file = await parseMultipart(req);
    tempPath = file.tempPath;
    logUpload(`Parse complete: ${file.filename}, ${(file.size / 1024 / 1024).toFixed(1)}MB, hash=${file.sha256Hash.substring(0, 12)}, temp=${tempPath}`);

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

    // Upload to storage from temp file (stream — no full RAM copy)
    logUpload(`Uploading to storage: ${storageKey}...`);
    const fileStream = fs.createReadStream(tempPath);
    await uploadFile(storageKey, fileStream, file.mimeType);
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

    // Return proper 413 for file size limit
    if (msg === "FILE_TOO_LARGE") {
      return Response.json(
        { error: "File too large", maxMb: MAX_FILE_SIZE / 1024 / 1024 },
        { status: 413 }
      );
    }
    return jsonError(msg, 500);
  } finally {
    // Always clean up temp file
    if (tempPath) {
      fsp.unlink(tempPath).catch(() => { /* ignore */ });
    }
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
