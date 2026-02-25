"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, ImageIcon, Video } from "lucide-react";
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

export default function NewProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: generateSlug(name) }));
  }

  function updateField(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
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

      const res = await fetch("/api/admin/products", {
        method: "POST",
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
      if (!res.ok) throw new Error(data.error || "Error al crear producto");

      // Redirigir a editar para subir imágenes
      router.push(`/admin/products/${data.id}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Nuevo Producto</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Aviso de imágenes y archivos */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <ImageIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Las imágenes y archivos descargables se suben después de crear el producto</p>
              <p className="text-blue-600 mt-0.5">Completa la info básica primero. Al guardar, se abrirá la página de edición donde podrás subir fotos, videos y los <strong>archivos de descarga</strong> (ZIP, schematic, config, JAR, etc.) que el comprador recibirá al pagar.</p>
            </div>
          </div>

          {/* Video URL */}
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
                Pega un enlace de YouTube. Se mostrará como miniatura en la página del producto — el comprador puede hacer click para ver el video.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre *</label>
                <Input
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Medieval Castle Spawn"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Slug (URL)</label>
                <Input
                  value={form.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                  placeholder="medieval-castle-spawn"
                />
                <p className="text-xs text-muted-foreground mt-1">Se genera automáticamente del nombre</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descripción corta</label>
                <Input
                  value={form.shortDescription}
                  onChange={(e) => updateField("shortDescription", e.target.value)}
                  placeholder="Descripción breve para las cards del catálogo"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descripción completa *</label>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Descripción detallada del producto..."
                  required
                />
              </div>
            </CardContent>
          </Card>

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
                    placeholder="12.00"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Tags (separados por coma)</label>
                <Input
                  value={form.tags}
                  onChange={(e) => updateField("tags", e.target.value)}
                  placeholder="spawn, medieval, castle, map"
                />
              </div>
            </CardContent>
          </Card>

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
              Crear y agregar imágenes
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
