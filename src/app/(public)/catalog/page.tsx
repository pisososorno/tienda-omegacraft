"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Package, Tag, ArrowRight, ImageIcon, Search, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  category: string;
  priceUsd: string;
  metadata: Record<string, unknown>;
  coverImage: string | null;
}

const categoryLabels: Record<string, string> = {
  plugins: "Plugin",
  source_code: "Source Code",
  configurations: "Config Pack",
  maps: "Map",
};

const categoryColors: Record<string, string> = {
  plugins: "bg-violet-500 text-white",
  source_code: "bg-emerald-500 text-white",
  configurations: "bg-blue-500 text-white",
  maps: "bg-orange-500 text-white",
};

const categoryFilterIcons: Record<string, string> = {
  all: "🎮",
  plugins: "⚡",
  maps: "🗺️",
  configurations: "⚙️",
  source_code: "💻",
};

export default function CatalogPage() {
  return (
    <Suspense fallback={
      <div className="container py-16 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3 mx-auto" />
          <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
        </div>
      </div>
    }>
      <CatalogContent />
    </Suspense>
  );
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat && ["plugins", "maps", "configurations", "source_code"].includes(cat)) {
      setFilter(cat);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categories = ["all", "plugins", "maps", "configurations", "source_code"];
  const categoryFilterLabels: Record<string, string> = {
    all: "Todos",
    plugins: "Plugins",
    maps: "Mapas",
    configurations: "Configs",
    source_code: "Source Code",
  };

  const filtered = (filter === "all" ? products : products.filter((p) => p.category === filter))
    .filter((p) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.shortDescription && p.shortDescription.toLowerCase().includes(q))
      );
    });

  return (
    <div style={{ backgroundColor: "var(--site-catalog-bg)" }} suppressHydrationWarning>
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0wIDZjMS42NTcgMCAzLTEuMzQzIDMtM3MtMS4zNDMtMy0zLTMtMyAxLjM0My0zIDMgMS4zNDMgMyAzIDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="container relative py-12 md:py-16">
          <div className="flex items-center gap-3 mb-3">
            <Store className="h-6 w-6 text-indigo-400" />
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Catálogo</h1>
          </div>
          <p className="text-white/50 text-lg max-w-xl">
            Plugins, mapas, configs y source code premium para tu servidor Minecraft.
          </p>

          {/* Search */}
          <div className="mt-6 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-transparent backdrop-blur-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Category filter tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                filter === cat
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              <span>{categoryFilterIcons[cat]}</span>
              {categoryFilterLabels[cat]}
              {filter === cat && (
                <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-md ml-1">
                  {filtered.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl overflow-hidden border">
                <div className="h-52 bg-muted" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-8 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No se encontraron productos</h2>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? "Intenta con otros términos de búsqueda." : "Vuelve pronto para ver nuevos lanzamientos."}
            </p>
            {(filter !== "all" || searchQuery) && (
              <Button
                variant="outline"
                onClick={() => {
                  setFilter("all");
                  setSearchQuery("");
                }}
                className="rounded-xl"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((product) => {
              const tags = Array.isArray((product.metadata as Record<string, unknown>)?.tags)
                ? ((product.metadata as Record<string, unknown>).tags as string[])
                : [];
              return (
                <Link key={product.id} href={`/catalog/${product.slug}`}>
                  <div className="group rounded-2xl overflow-hidden border hover:shadow-2xl transition-all duration-500 cursor-pointer h-full flex flex-col" style={{ backgroundColor: "var(--site-card-bg, #ffffff)" }}>
                    {/* Image */}
                    <div className="relative h-52 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                      {product.coverImage ? (
                        <img
                          src={product.coverImage}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-12 w-12 text-slate-300" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute top-3 left-3">
                        <Badge className={`${categoryColors[product.category] || "bg-gray-500 text-white"} shadow-lg text-xs`}>
                          {categoryLabels[product.category] || product.category}
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg group-hover:text-indigo-600 transition-colors mb-1.5">
                        {product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">
                        {product.shortDescription || "Producto digital premium para Minecraft."}
                      </p>

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {tags.slice(0, 4).map((tag: string) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-md"
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Price + CTA */}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <span className="text-2xl font-extrabold">${product.priceUsd}</span>
                        <span className="text-sm font-medium text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          Ver detalle <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Results count */}
        {!loading && filtered.length > 0 && (
          <div className="text-center mt-8 text-sm text-muted-foreground">
            Mostrando {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
            {filter !== "all" && ` en ${categoryFilterLabels[filter]}`}
          </div>
        )}
      </div>
    </div>
  );
}
