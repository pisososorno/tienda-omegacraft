"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, EyeOff, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatVersionLabel } from "@/lib/compatibility";

interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  category: string;
  priceUsd: string;
  isActive: boolean;
  minecraftVersionMin: string | null;
  minecraftVersionMax: string | null;
  supportedVersions: string[];
  platforms: string[];
  orderCount: number;
  fileCount: number;
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  plugins: "Plugin",
  configurations: "Config Pack",
  source_code: "Source Code",
  maps: "Map",
};

const categoryColors: Record<string, string> = {
  plugins: "bg-violet-100 text-violet-700",
  configurations: "bg-blue-100 text-blue-700",
  source_code: "bg-emerald-100 text-emerald-700",
  maps: "bg-orange-100 text-orange-700",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  function fetchProducts() {
    setLoading(true);
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  async function toggleActive(id: string, currentActive: boolean) {
    await fetch(`/api/admin/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currentActive }),
    });
    fetchProducts();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"? Si tiene órdenes, se desactivará en vez de eliminarse.`)) return;
    setDeleting(id);
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    fetchProducts();
    setDeleting(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm">{products.length} productos en total</p>
        </div>
        <Link href="/admin/products/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay productos aún.</p>
            <Link href="/admin/products/new">
              <Button className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Crear primer producto
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Producto</th>
                <th className="text-left px-4 py-3 font-medium">Categoría</th>
                <th className="text-left px-4 py-3 font-medium">Precio</th>
                <th className="text-left px-4 py-3 font-medium">Compatibilidad</th>
                <th className="text-center px-4 py-3 font-medium">Archivos</th>
                <th className="text-center px-4 py-3 font-medium">Órdenes</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={categoryColors[p.category] || ""}>
                      {categoryLabels[p.category] || p.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono">${p.priceUsd}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        const vLabel = formatVersionLabel(p.supportedVersions || [], p.minecraftVersionMin, p.minecraftVersionMax);
                        return vLabel ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px]">
                            MC {vLabel}
                          </Badge>
                        ) : null;
                      })()}
                      {(p.platforms || []).map((pl) => (
                        <Badge key={pl} variant="secondary" className="bg-slate-100 text-slate-600 text-[10px]">
                          {pl}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">{p.fileCount}</td>
                  <td className="px-4 py-3 text-center">{p.orderCount}</td>
                  <td className="px-4 py-3 text-center">
                    {p.isActive ? (
                      <Badge className="bg-green-100 text-green-700">Activo</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-500">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/products/${p.id}/edit`}>
                        <Button variant="ghost" size="icon" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={p.isActive ? "Desactivar" : "Activar"}
                        onClick={() => toggleActive(p.id, p.isActive)}
                      >
                        {p.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        title="Eliminar"
                        disabled={deleting === p.id}
                        onClick={() => handleDelete(p.id, p.name)}
                      >
                        {deleting === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
