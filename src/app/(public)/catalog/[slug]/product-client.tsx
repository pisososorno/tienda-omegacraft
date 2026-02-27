"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Download,
  FileText,
  Shield,
  Package,
  Tag,
  ChevronLeft,
  ChevronRight,
  Play,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatVersionLabel } from "@/lib/compatibility";

interface ProductFile {
  id: string;
  filename: string;
  fileSize: string;
  mimeType: string;
}

interface ProductImage {
  id: string;
  storageKey: string;
  altText: string | null;
  isPrimary: boolean;
}

interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string;
  category: string;
  priceUsd: string;
  metadata: Record<string, unknown>;
  videoUrl?: string | null;
  minecraftVersionMin?: string | null;
  minecraftVersionMax?: string | null;
  supportedVersions?: string[];
  platforms?: string[];
  downloadLimit: number;
  downloadExpiresDays: number;
  images: ProductImage[];
  files: ProductFile[];
}

const categoryLabels: Record<string, string> = {
  plugins: "Plugin",
  source_code: "Source Code",
  configurations: "Config Pack",
  maps: "Map",
};

const categoryColors: Record<string, string> = {
  plugins: "bg-violet-100 text-violet-700",
  source_code: "bg-emerald-100 text-emerald-700",
  configurations: "bg-blue-100 text-blue-700",
  maps: "bg-orange-100 text-orange-700",
};

function formatBytes(bytes: string): string {
  const b = parseInt(bytes, 10);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function normalizeImageUrl(url: string): string {
  if (url.startsWith("/") || url.startsWith("http")) return url;
  return `/${url}`;
}

export default function ProductPageClient() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    if (!params.slug) return;
    fetch(`/api/products/${params.slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) {
    return (
      <div className="container py-12 max-w-5xl">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-muted rounded w-48" />
          <div className="h-[400px] bg-muted rounded-xl" />
          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2 space-y-3">
              <div className="h-8 bg-muted rounded w-2/3" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
            <div className="h-48 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-20 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Producto no encontrado</h1>
        <Button variant="outline" onClick={() => router.push("/catalog")}>
          Volver al catálogo
        </Button>
      </div>
    );
  }

  const hasImages = product.images.length > 0;
  const youtubeId = product.videoUrl ? getYouTubeId(product.videoUrl) : null;
  const tags = Array.isArray((product.metadata as Record<string, unknown>)?.tags)
    ? ((product.metadata as Record<string, unknown>).tags as string[])
    : [];

  return (
    <div className="container py-8 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
        <button onClick={() => router.push("/catalog")} className="hover:text-foreground transition-colors">
          Catálogo
        </button>
        <span aria-hidden="true">/</span>
        <span className="text-foreground font-medium truncate">{product.name}</span>
      </nav>

      {/* Image Gallery */}
      {(hasImages || youtubeId) && (
        <div className="mb-8">
          {/* Main image / video */}
          <div className="relative rounded-xl overflow-hidden bg-muted aspect-[16/9] max-h-[480px]">
            {showVideo && youtubeId ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                className="w-full h-full absolute inset-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={product.name}
              />
            ) : hasImages ? (
              <>
                <img
                  src={normalizeImageUrl(product.images[activeImage]?.storageKey || "/uploads/placeholder.png")}
                  alt={product.images[activeImage]?.altText || `${product.name} — imagen ${activeImage + 1}`}
                  className="w-full h-full object-cover"
                />
                {product.images.length > 1 && (
                  <>
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
                      onClick={() => setActiveImage((i) => (i === 0 ? product.images.length - 1 : i - 1))}
                      aria-label="Imagen anterior"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
                      onClick={() => setActiveImage((i) => (i === product.images.length - 1 ? 0 : i + 1))}
                      aria-label="Imagen siguiente"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
                {youtubeId && (
                  <button
                    className="absolute bottom-3 right-3 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-medium transition-colors shadow-lg"
                    onClick={() => setShowVideo(true)}
                  >
                    <Play className="h-4 w-4 fill-white" /> Ver video
                  </button>
                )}
              </>
            ) : youtubeId ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                className="w-full h-full absolute inset-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={product.name}
              />
            ) : null}
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              {product.images.map((img, i) => (
                <button
                  key={img.id}
                  className={`relative rounded-lg overflow-hidden border-2 flex-shrink-0 transition-colors ${
                    i === activeImage && !showVideo
                      ? "border-primary"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                  onClick={() => {
                    setActiveImage(i);
                    setShowVideo(false);
                  }}
                  aria-label={`Ver imagen ${i + 1}`}
                >
                  <img
                    src={normalizeImageUrl(img.storageKey)}
                    alt={img.altText || `${product.name} — miniatura ${i + 1}`}
                    className="w-20 h-14 object-cover"
                  />
                </button>
              ))}
              {youtubeId && (
                <button
                  className={`relative rounded-lg overflow-hidden border-2 flex-shrink-0 transition-colors ${
                    showVideo ? "border-red-500" : "border-transparent hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setShowVideo(true)}
                  aria-label="Ver video del producto"
                >
                  <div className="w-20 h-14 bg-red-100 flex items-center justify-center">
                    <Play className="h-5 w-5 text-red-600 fill-red-600" />
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Badge className={categoryColors[product.category] || "bg-gray-100 text-gray-700"}>
                {categoryLabels[product.category] || product.category}
              </Badge>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {product.name}
            </h1>
            {product.shortDescription && (
              <p className="text-lg text-muted-foreground">
                {product.shortDescription}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="prose prose-sm max-w-none border-t pt-6">
            {product.description.split("\n").map((line, i) => {
              if (line.startsWith("# "))
                return (
                  <h2 key={i} className="text-xl font-bold mt-6 mb-2">
                    {line.replace("# ", "")}
                  </h2>
                );
              if (line.startsWith("## "))
                return (
                  <h3 key={i} className="text-lg font-semibold mt-4 mb-1">
                    {line.replace("## ", "")}
                  </h3>
                );
              if (line.startsWith("- "))
                return (
                  <li key={i} className="text-muted-foreground ml-4">
                    {line.replace("- ", "")}
                  </li>
                );
              if (line.trim() === "") return <br key={i} />;
              return (
                <p key={i} className="text-muted-foreground">
                  {line}
                </p>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-3xl font-bold">
                ${product.priceUsd}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full gap-2 h-12 text-base font-semibold"
                size="lg"
                onClick={() =>
                  router.push(`/checkout?product=${product.slug}`)
                }
              >
                <CreditCard className="h-5 w-5" />
                Comprar ahora
              </Button>

              <div className="bg-[#FFC439] hover:bg-[#f5bb36] text-black rounded-md h-11 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                onClick={() => router.push(`/checkout?product=${product.slug}`)}
              >
                <span className="italic font-black tracking-tight">Pay</span>
                <span className="italic font-black tracking-tight text-[#003087]">Pal</span>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span>
                    {product.downloadLimit} descargas, {product.downloadExpiresDays} días
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Entrega segura con licencia</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compatibilidad */}
          {(() => {
            const vLabel = formatVersionLabel(product.supportedVersions || [], product.minecraftVersionMin, product.minecraftVersionMax);
            const plats = product.platforms || [];
            if (!vLabel && plats.length === 0) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Compatibilidad
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {vLabel && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Minecraft</span>
                      {(product.supportedVersions && product.supportedVersions.length > 0) ? (
                        <div className="flex flex-wrap gap-1">
                          {product.supportedVersions.map((v) => (
                            <Badge key={v} variant="secondary" className="bg-green-50 text-green-700 text-xs">
                              {v}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="bg-green-50 text-green-700 text-xs">
                          {vLabel}
                        </Badge>
                      )}
                    </div>
                  )}
                  {plats.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Plataformas</span>
                      <div className="flex flex-wrap gap-1">
                        {plats.map((pl) => (
                          <Badge key={pl} variant="secondary" className="bg-blue-50 text-blue-700 text-xs">
                            {pl}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {product.files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Archivos incluidos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {product.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{file.filename}</span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {formatBytes(file.fileSize)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
