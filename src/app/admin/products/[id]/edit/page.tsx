"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Upload, X, Star, ImageIcon, Video } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const categories = [
  { value: "plugins", label: "Plugin" },
  { value: "configurations", label: "Config Pack" },
  { value: "source_code", label: "Source Code" },
  { value: "maps", label: "Map" },
];

interface ProductImage {
  id: string;
  storageKey: string;
  altText: string | null;
  sortOrder: number;
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
  isActive: boolean;
  metadata: { tags?: string[] };
  videoUrl?: string | null;
  downloadLimit: number;
  downloadExpiresDays: number;
  images: ProductImage[];
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<ProductImage[]>([]);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    shortDescription: "",
    description: "",
    category: "plugins",
    priceUsd: "",
    tags: "",
    videoUrl: "",
    downloadLimit: "3",
    downloadExpiresDays: "7",
    isActive: true,
  });

  const fetchProduct = useCallback(() => {
    if (!params.id) return;
    fetch(`/api/admin/products/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((p: ProductDetail) => {
        setForm({
          name: p.name,
          slug: p.slug,
          shortDescription: p.shortDescription || "",
          description: p.description,
          category: p.category,
          priceUsd: p.priceUsd,
          tags: (p.metadata?.tags || []).join(", "),
          videoUrl: p.videoUrl || "",
          downloadLimit: String(p.downloadLimit),
          downloadExpiresDays: String(p.downloadExpiresDays),
          isActive: p.isActive,
        });
        setImages(p.images || []);
      })
      .catch(() => setError("Producto no encontrado"))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  function updateField(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);

        const uploadRes = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error);

        await fetch(`/api/admin/products/${params.id}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: uploadData.url,
            isPrimary: images.length === 0 && i === 0,
          }),
        });
      }
      fetchProduct();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteImage(imageId: string) {
    await fetch(`/api/admin/products/${params.id}/images?imageId=${imageId}`, {
      method: "DELETE",
    });
    fetchProduct();
  }

  async function handleSetPrimary(imageId: string) {
    try {
      const res = await fetch(`/api/admin/products/${params.id}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      if (!res.ok) throw new Error("Error al marcar portada");
      setImages((imgs) =>
        imgs.map((img) => ({ ...img, isPrimary: img.id === imageId }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al marcar portada");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/admin/products/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          shortDescription: form.shortDescription || null,
          description: form.description,
          category: form.category,
          priceUsd: form.priceUsd,
          metadata: { tags },
          videoUrl: form.videoUrl || null,
          downloadLimit: parseInt(form.downloadLimit) || 3,
          downloadExpiresDays: parseInt(form.downloadExpiresDays) || 7,
          isActive: form.isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");

      router.push("/admin/products");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Editar Producto</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Imágenes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Imágenes del producto
                </CardTitle>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                    <span>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Subir imágenes
                    </span>
                  </Button>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {images.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No hay imágenes aún</p>
                  <p className="text-xs mt-1">Sube screenshots, fotos del mapa, lobby o spawn para atraer compradores</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border">
                      <img
                        src={img.storageKey.startsWith("/") || img.storageKey.startsWith("http") ? img.storageKey : `/${img.storageKey}`}
                        alt={img.altText || ""}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          title="Portada principal"
                          onClick={() => handleSetPrimary(img.id)}
                        >
                          <Star className={`h-4 w-4 ${img.isPrimary ? "fill-yellow-400 text-yellow-400" : ""}`} />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteImage(img.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {img.isPrimary && (
                        <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          PORTADA
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Formatos: JPG, PNG, WebP, GIF. Máx 5MB por imagen. La imagen marcada como PORTADA se muestra en el catálogo.
              </p>
            </CardContent>
          </Card>

          {/* Video */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4" />
                Video (opcional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={form.videoUrl}
                onChange={(e) => updateField("videoUrl", e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pega un enlace de YouTube para mostrar un video del producto en la página de detalle
              </p>
            </CardContent>
          </Card>

          {/* Info básica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre *</label>
                <Input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Slug (URL)</label>
                <Input
                  value={form.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descripción corta</label>
                <Input
                  value={form.shortDescription}
                  onChange={(e) => updateField("shortDescription", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descripción completa *</label>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Precio */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Precio y categoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Categoría *</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Precio (USD) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.priceUsd}
                    onChange={(e) => updateField("priceUsd", e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tags (separados por coma)</label>
                <Input
                  value={form.tags}
                  onChange={(e) => updateField("tags", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Descarga */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuración de descarga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Límite de descargas</label>
                  <Input
                    type="number"
                    min="1"
                    value={form.downloadLimit}
                    onChange={(e) => updateField("downloadLimit", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Días para expirar enlace</label>
                  <Input
                    type="number"
                    min="1"
                    value={form.downloadExpiresDays}
                    onChange={(e) => updateField("downloadExpiresDays", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => updateField("isActive", e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="isActive" className="text-sm">Producto activo (visible en el catálogo)</label>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Cambios
            </Button>
            <Link href="/admin/products">
              <Button type="button" variant="outline">Cancelar</Button>
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
