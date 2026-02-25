import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { uploadFile, deleteFile } from "@/lib/storage";
import crypto from "crypto";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const ALLOWED_EXTENSIONS = [
  ".zip", ".rar", ".7z", ".tar.gz", ".gz",
  ".jar", ".sk", ".yml", ".yaml", ".json",
  ".schematic", ".schem", ".nbt", ".litematic",
  ".mcworld", ".mcpack", ".mcaddon",
  ".png", ".jpg", ".txt", ".md", ".pdf",
];

// GET — list files for a product
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

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

// POST — upload a new file for a product
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

  // Verify product exists
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return jsonError("Product not found", 404);

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return jsonError("No file provided", 400);

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return jsonError(`File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400);
    }

    // Validate extension
    const filename = file.name;
    const ext = "." + filename.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((e) => filename.toLowerCase().endsWith(e))) {
      return jsonError(`Extension not allowed: ${ext}`, 400);
    }

    // Read file buffer and compute SHA-256
    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256Hash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Generate storage key
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `products/${id}/${timestamp}-${safeFilename}`;

    // Upload to storage (S3 or local)
    await uploadFile(storageKey, buffer, file.type || "application/octet-stream");

    // Count existing files for sort order
    const existingCount = await prisma.productFile.count({ where: { productId: id } });

    // Create DB record
    const productFile = await prisma.productFile.create({
      data: {
        productId: id,
        filename: filename,
        storageKey: storageKey,
        fileSize: BigInt(file.size),
        sha256Hash: sha256Hash,
        mimeType: file.type || "application/octet-stream",
        sortOrder: existingCount,
        isPrimary: existingCount === 0,
      },
    });

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
    console.error("[api/admin/products/files POST]", error);
    return jsonError("Error uploading file", 500);
  }
}

// DELETE — remove a file
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return jsonError("Unauthorized", 401);

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
