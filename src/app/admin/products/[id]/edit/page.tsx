"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Upload, X, Star, ImageIcon, Video, FileArchive, Trash2, Cpu, Blocks } from "lucide-react";
import { MC_VERSION_PRESETS, PLATFORMS } from "@/lib/compatibility";
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

interface ProductFile {
  id: string;
  filename: string;
  fileSize: string;
  mimeType: string;
  sha256Hash: string;
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
  minecraftVersionMin?: string | null;
  minecraftVersionMax?: string | null;
  supportedVersions?: string[];
  platforms?: string[];
  downloadLimit: number;
  downloadExpiresDays: number;
  images: ProductImage[];
  files?: ProductFile[];
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [uploadFileName, setUploadFileName] = useState("");
  const [error, setError] = useState("");
  const [images, setImages] = useState<ProductImage[]>([]);
  const [files, setFiles] = useState<ProductFile[]>([]);

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
    minecraftVersionMin: "",
    minecraftVersionMax: "",
  });
  const [supportedVersions, setSupportedVersions] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);

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
          minecraftVersionMin: p.minecraftVersionMin || "",
          minecraftVersionMax: p.minecraftVersionMax || "",
        });
        setSupportedVersions(p.supportedVersions || []);
        setPlatforms(p.platforms || []);
        setImages(p.images || []);
        setFiles(p.files || []);
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

  function uploadFileWithProgress(file: File, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);

      console.log(`[upload] Starting XHR upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB) → ${url}`);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          console.log(`[upload] progress: ${pct}% (${(e.loaded / 1024 / 1024).toFixed(1)}MB / ${(e.total / 1024 / 1024).toFixed(1)}MB)`);
          setUploadProgress(pct);
        } else {
          console.log(`[upload] progress event: NOT lengthComputable, loaded=${e.loaded}`);
        }
      });

      xhr.upload.addEventListener("loadend", () => {
        console.log(`[upload] upload.loadend — browser finished sending data`);
      });

      xhr.addEventListener("load", () => {
        console.log(`[upload] XHR load: status=${xhr.status}`);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.error || `Error ${xhr.status}`));
          } catch {
            reject(new Error(`Error ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener("error", (e) => {
        console.error(`[upload] XHR error event:`, e);
        reject(new Error("Error de red al subir archivo"));
      });
      xhr.addEventListener("timeout", () => {
        console.error(`[upload] XHR timeout after ${xhr.timeout}ms`);
        reject(new Error("Tiempo de espera agotado"));
      });
      xhr.addEventListener("abort", () => {
        console.error(`[upload] XHR aborted`);
      });
      xhr.timeout = 600000; // 10 minutes

      const formData = new FormData();
      formData.append("file", file);
      xhr.send(formData);
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploadingFile(true);
    setUploadProgress(0);
    setError("");
    try {
      for (let i = 0; i < fileList.length; i++) {
        setUploadFileName(fileList[i].name);
        setUploadProgress(0);
        await uploadFileWithProgress(
          fileList[i],
          `/api/admin/products/${params.id}/files`
        );
      }
      setUploadProgress(100);
      fetchProduct();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al subir archivo");
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
      setUploadFileName("");
      e.target.value = "";
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await fetch(`/api/admin/products/${params.id}/files?fileId=${fileId}`, {
        method: "DELETE",
      });
      fetchProduct();
    } catch {
      setError("Error al eliminar archivo");
    }
  }

  function formatFileSize(bytes: string): string {
    const b = parseInt(bytes, 10);
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(1) + " MB";
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
          minecraftVersionMin: form.minecraftVersionMin || null,
          minecraftVersionMax: form.minecraftVersionMax || null,
          supportedVersions,
          platforms,
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

          {/* Archivos descargables */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileArchive className="h-4 w-4" />
                  Archivos descargables
                </CardTitle>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".zip,.rar,.7z,.tar.gz,.jar,.sk,.yml,.yaml,.json,.schematic,.schem,.nbt,.litematic,.mcworld,.mcpack,.mcaddon,.png,.jpg,.txt,.md,.pdf"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                  />
                  <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                    <span>
                      {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Subir archivo
                    </span>
                  </Button>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {/* Upload progress bar */}
              {uploadingFile && (
                <div className="mb-4 p-3 rounded-lg border bg-indigo-50/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-indigo-700 truncate max-w-[70%]">
                      {uploadFileName || "Subiendo archivo..."}
                    </span>
                    <span className="text-sm font-bold text-indigo-700">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-indigo-100 rounded-full h-2.5">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-indigo-500 mt-1.5">
                    {uploadProgress < 100
                      ? "Subiendo al servidor... no cierres esta página."
                      : "Procesando archivo..."}
                  </p>
                </div>
              )}

              {files.length === 0 && !uploadingFile ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <FileArchive className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No hay archivos de descarga</p>
                  <p className="text-xs mt-1">Sube el archivo ZIP, schematic, JAR o cualquier archivo que el comprador recibirá al pagar.</p>
                </div>
              ) : files.length > 0 ? (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileArchive className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{f.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(f.fileSize)} · {f.mimeType} · SHA256: {f.sha256Hash.slice(0, 12)}…
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteFile(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground mt-3">
                Formatos: ZIP, RAR, JAR, schematic, SCHEM, YML, JSON, etc. Máx 500MB por archivo.
                Este es el archivo que el comprador descarga después de pagar.
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

          {/* Compatibilidad */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Blocks className="h-4 w-4" />
                Compatibilidad Minecraft
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Versiones soportadas — chips */}
              <div>
                <label className="text-sm font-medium mb-2 block">Versiones soportadas</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {supportedVersions.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                      {v}
                      <button
                        type="button"
                        onClick={() => setSupportedVersions((prev) => prev.filter((x) => x !== v))}
                        className="hover:text-indigo-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {MC_VERSION_PRESETS.filter((v) => !supportedVersions.includes(v)).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSupportedVersions((prev) => [...prev, v].sort())}
                      className="text-[11px] px-2 py-0.5 rounded border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Selecciona las versiones exactas soportadas. Si está vacío, se usará el rango min/max.
                </p>
              </div>

              {/* Rango min/max como alternativa */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Versión mínima</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.minecraftVersionMin}
                    onChange={(e) => updateField("minecraftVersionMin", e.target.value)}
                  >
                    <option value="">Sin definir</option>
                    {MC_VERSION_PRESETS.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Versión máxima</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.minecraftVersionMax}
                    onChange={(e) => updateField("minecraftVersionMax", e.target.value)}
                  >
                    <option value="">Sin definir</option>
                    {MC_VERSION_PRESETS.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Plataformas */}
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  Plataformas
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <label
                      key={p}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                        platforms.includes(p)
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={platforms.includes(p)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPlatforms((prev) => [...prev, p]);
                          } else {
                            setPlatforms((prev) => prev.filter((x) => x !== p));
                          }
                        }}
                        className="rounded"
                      />
                      {p}
                    </label>
                  ))}
                </div>
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
