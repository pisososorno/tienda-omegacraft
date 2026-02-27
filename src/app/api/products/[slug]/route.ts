import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const product = await prisma.product.findUnique({
      where: { slug, isActive: true },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        files: {
          select: {
            id: true,
            filename: true,
            fileSize: true,
            mimeType: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!product) {
      return jsonError("Product not found", 404);
    }

    return jsonOk({
      id: product.id,
      slug: product.slug,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      category: product.category,
      priceUsd: product.priceUsd.toString(),
      metadata: product.metadata,
      videoUrl: product.videoUrl,
      minecraftVersionMin: product.minecraftVersionMin,
      minecraftVersionMax: product.minecraftVersionMax,
      supportedVersions: product.supportedVersions,
      platforms: product.platforms,
      downloadLimit: product.downloadLimit,
      downloadExpiresDays: product.downloadExpiresDays,
      images: product.images,
      files: product.files.map((f) => ({
        ...f,
        fileSize: f.fileSize.toString(),
      })),
    });
  } catch (error) {
    console.error("[api/products/slug]", error);
    return jsonError("Internal server error", 500);
  }
}
