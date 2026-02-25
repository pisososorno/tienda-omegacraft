import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { withAdminAuth, isAuthError, ROLES_ALL } from "@/lib/rbac";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  const auth = await withAdminAuth(req, { roles: ROLES_ALL });
  if (isAuthError(auth)) return auth;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return jsonError("No file provided");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return jsonError("Invalid file type. Allowed: jpg, png, webp, gif");
    }

    if (file.size > 5 * 1024 * 1024) {
      return jsonError("File too large. Max 5MB");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop() || "jpg";
    const hash = crypto.randomBytes(8).toString("hex");
    const filename = `${Date.now()}-${hash}.${ext}`;

    await mkdir(UPLOADS_DIR, { recursive: true });

    const filepath = path.join(UPLOADS_DIR, filename);
    await writeFile(filepath, buffer);

    return jsonOk({
      url: `/api/uploads/${filename}`,
      filename: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error("[api/admin/upload]", error);
    return jsonError("Upload failed", 500);
  }
}
