import { NextRequest } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filename = segments.join("/");

  // Prevent directory traversal
  if (filename.includes("..") || filename.startsWith("/")) {
    return new Response("Forbidden", { status: 403 });
  }

  const filepath = path.join(UPLOADS_DIR, filename);

  try {
    const fileStat = await stat(filepath);
    if (!fileStat.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const buffer = await readFile(filepath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
