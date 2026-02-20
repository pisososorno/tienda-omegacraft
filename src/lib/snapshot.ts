import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sha256 } from "./hashing";

/**
 * Create a JSON snapshot of the product at purchase time.
 * This is the primary forensic snapshot — always created.
 */
export async function createProductSnapshot(
  orderId: string,
  productData: Record<string, unknown>
): Promise<string> {
  const snapshotJson = JSON.stringify(productData, null, 2);
  const snapshotHash = sha256(snapshotJson);

  const snapshot = await prisma.orderSnapshot.create({
    data: {
      orderId,
      snapshotType: "json",
      snapshotJson: productData as Prisma.InputJsonValue,
      snapshotHash,
    },
  });

  return snapshot.id;
}

/**
 * Build the product data object for snapshotting.
 * Captures everything the buyer saw at purchase time.
 */
export async function buildProductSnapshotData(
  productId: string
): Promise<Record<string, unknown>> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      files: {
        select: {
          id: true,
          filename: true,
          fileSize: true,
          sha256Hash: true,
          mimeType: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      images: {
        select: {
          id: true,
          storageKey: true,
          altText: true,
          sortOrder: true,
          isPrimary: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!product) throw new Error(`Product ${productId} not found`);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    category: product.category,
    priceUsd: product.priceUsd.toString(),
    metadata: product.metadata,
    isActive: product.isActive,
    downloadLimit: product.downloadLimit,
    downloadExpiresDays: product.downloadExpiresDays,
    files: product.files.map((f: { id: string; filename: string; fileSize: bigint; sha256Hash: string; mimeType: string; sortOrder: number }) => ({
      ...f,
      fileSize: f.fileSize.toString(),
    })),
    images: product.images,
    snapshotTakenAt: new Date().toISOString(),
  };
}
