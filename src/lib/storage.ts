import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import mime from "mime-types";

// ── S3 client (lazy init) ─────────────────────────────────
let _client: S3Client | null = null;

function isS3Configured(): boolean {
  return !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

function getClient(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
  return _client;
}

function getBucket(): string {
  return process.env.S3_BUCKET || "tienda-digital";
}

// ── Local storage helpers ─────────────────────────────────
function getLocalBasePath(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
}

function getLocalFilePath(key: string): string {
  return path.join(getLocalBasePath(), "files", key);
}

/**
 * Upload a file to S3/R2 or local filesystem.
 */
export async function uploadFile(
  key: string,
  body: Buffer | Readable,
  contentType?: string
): Promise<void> {
  if (isS3Configured()) {
    await getClient().send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  } else {
    const filePath = getLocalFilePath(key);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    if (Buffer.isBuffer(body)) {
      await fsp.writeFile(filePath, body);
    } else {
      const writable = fs.createWriteStream(filePath);
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        writable.write(chunk);
      }
      writable.end();
      await new Promise<void>((resolve, reject) => {
        writable.on("finish", resolve);
        writable.on("error", reject);
      });
    }
  }
}

/**
 * Get file metadata (size, content type) without downloading.
 */
export async function headFile(
  key: string
): Promise<{ contentLength: number; contentType: string } | null> {
  if (isS3Configured()) {
    try {
      const res = await getClient().send(
        new HeadObjectCommand({
          Bucket: getBucket(),
          Key: key,
        })
      );
      return {
        contentLength: res.ContentLength || 0,
        contentType: res.ContentType || "application/octet-stream",
      };
    } catch {
      return null;
    }
  } else {
    try {
      const filePath = getLocalFilePath(key);
      const stat = await fsp.stat(filePath);
      const ct = mime.lookup(filePath) || "application/octet-stream";
      return { contentLength: stat.size, contentType: ct };
    } catch {
      return null;
    }
  }
}

/**
 * Download a file as a readable stream.
 * Supports Range requests for resume/partial downloads.
 */
export async function downloadFileStream(
  key: string,
  range?: string
): Promise<{
  stream: Readable | fs.ReadStream;
  contentLength: number;
  contentType: string;
  contentRange?: string;
  statusCode: number;
} | null> {
  if (isS3Configured()) {
    try {
      const command = new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Range: range,
      });
      const res = await getClient().send(command);
      if (!res.Body) return null;
      return {
        stream: res.Body as Readable,
        contentLength: res.ContentLength || 0,
        contentType: res.ContentType || "application/octet-stream",
        contentRange: res.ContentRange,
        statusCode: res.ContentRange ? 206 : 200,
      };
    } catch {
      return null;
    }
  } else {
    try {
      const filePath = getLocalFilePath(key);
      const stat = await fsp.stat(filePath);
      const ct = mime.lookup(filePath) || "application/octet-stream";

      if (range) {
        const match = range.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
          const stream = fs.createReadStream(filePath, { start, end });
          return {
            stream,
            contentLength: end - start + 1,
            contentType: ct,
            contentRange: `bytes ${start}-${end}/${stat.size}`,
            statusCode: 206,
          };
        }
      }

      const stream = fs.createReadStream(filePath);
      return {
        stream,
        contentLength: stat.size,
        contentType: ct,
        statusCode: 200,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Download entire file as Buffer.
 */
export async function downloadFileBuffer(key: string): Promise<Buffer | null> {
  if (isS3Configured()) {
    try {
      const res = await getClient().send(
        new GetObjectCommand({
          Bucket: getBucket(),
          Key: key,
        })
      );
      if (!res.Body) return null;
      const chunks: Uint8Array[] = [];
      for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  } else {
    try {
      const filePath = getLocalFilePath(key);
      return await fsp.readFile(filePath);
    } catch {
      return null;
    }
  }
}

/**
 * Delete a file from S3/R2 or local filesystem.
 */
export async function deleteFile(key: string): Promise<void> {
  if (isS3Configured()) {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    );
  } else {
    try {
      const filePath = getLocalFilePath(key);
      await fsp.unlink(filePath);
    } catch {
      // File may not exist, ignore
    }
  }
}
