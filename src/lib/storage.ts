import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";

let _client: S3Client | null = null;

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

/**
 * Upload a file to S3/R2.
 */
export async function uploadFile(
  key: string,
  body: Buffer | Readable,
  contentType?: string
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Get file metadata (size, content type) without downloading.
 */
export async function headFile(
  key: string
): Promise<{ contentLength: number; contentType: string } | null> {
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
}

/**
 * Download a file from S3/R2 as a readable stream.
 * Supports Range requests for resume/partial downloads.
 */
export async function downloadFileStream(
  key: string,
  range?: string
): Promise<{
  stream: Readable;
  contentLength: number;
  contentType: string;
  contentRange?: string;
  statusCode: number;
} | null> {
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
}

/**
 * Download entire file as Buffer.
 */
export async function downloadFileBuffer(key: string): Promise<Buffer | null> {
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
}

/**
 * Delete a file from S3/R2.
 */
export async function deleteFile(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}
