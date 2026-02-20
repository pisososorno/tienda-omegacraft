"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Zap,
  Download,
  Star,
  Tag,
  ImageIcon,
  Sparkles,
  Trophy,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/components/providers/site-settings-provider";

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
  plugins: "bg-violet-500",
  source_code: "bg-emerald-500",
  configurations: "bg-blue-500",
  maps: "bg-orange-500",
};

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { storeSlogan, heroTitle, heroDescription } = useSiteSettings();

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const featured = products.slice(0, 3);
  const latest = products.slice(0, 4);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/images/hero/hero-bg.svg" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-50/10" />

        <div className="relative container py-24 md:py-36">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-white/80">{storeSlogan}</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
              {heroTitle}
            </h1>
            
            <p className="text-lg md:text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
              {heroDescription}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/catalog">
                <Button size="lg" className="h-13 px-8 text-base font-semibold bg-white text-slate-900 hover:bg-white/90 gap-2 rounded-xl">
                  Explorar catálogo
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/catalog">
                <Button size="lg" variant="outline" className="h-13 px-8 text-base font-semibold border-white/20 text-white hover:bg-white/10 gap-2 rounded-xl">
                  Ver novedades
                  <Clock className="h-5 w-5" />
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-8 md:gap-12 mt-16 pt-8 border-t border-white/10">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">{products.length}+</div>
                <div className="text-sm text-white/50">Productos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">24/7</div>
                <div className="text-sm text-white/50">Entrega instantánea</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">100%</div>
                <div className="text-sm text-white/50">Seguro</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="container">
          <div className="flex items-center justify-between mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-semibold text-yellow-600 uppercase tracking-wider">Destacados</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Productos populares</h2>
            </div>
            <Link href="/catalog">
              <Button variant="outline" className="gap-2 rounded-xl">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map((product, idx) => (
                <Link key={product.id} href={`/catalog/${product.slug}`}>
                  <div className="group relative rounded-2xl overflow-hidden border hover:shadow-2xl transition-all duration-500 cursor-pointer h-full flex flex-col" style={{ backgroundColor: "var(--site-card-bg, #ffffff)" }}>
                    {idx === 0 && (
                      <div className="absolute top-3 right-3 z-10 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                        <Star className="h-3 w-3 fill-yellow-900" /> POPULAR
                      </div>
                    )}
                    <div className="relative h-52 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                      {product.coverImage ? (
                        <img
                          src={product.coverImage}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <ImageIcon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-3 left-3">
                        <Badge className={`${categoryColors[product.category] || "bg-gray-500"} text-white text-xs shadow-lg`}>
                          {categoryLabels[product.category] || product.category}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg group-hover:text-indigo-600 transition-colors mb-1.5">
                        {product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                        {product.shortDescription || "Producto digital premium para Minecraft."}
                      </p>
                      <div className="flex items-center justify-between pt-3 border-t">
                        <span className="text-2xl font-extrabold">${product.priceUsd}</span>
                        <span className="text-sm font-medium text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          Ver detalle <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Explora por categoría</h2>
            <p className="text-muted-foreground text-lg">Encuentra exactamente lo que necesitas para tu servidor</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { cat: "maps", icon: "🗺️", label: "Mapas", desc: "Spawns, lobbies, dungeons", gradient: "from-orange-500 to-amber-500" },
              { cat: "plugins", icon: "⚡", label: "Plugins", desc: "Funcionalidades únicas", gradient: "from-violet-500 to-purple-500" },
              { cat: "configurations", icon: "⚙️", label: "Configs", desc: "Setup listo para usar", gradient: "from-blue-500 to-cyan-500" },
              { cat: "source_code", icon: "💻", label: "Source Code", desc: "Código fuente completo", gradient: "from-emerald-500 to-green-500" },
            ].map((c) => (
              <Link key={c.cat} href={`/catalog?category=${c.cat}`}>
                <div className={`relative rounded-2xl overflow-hidden p-6 bg-gradient-to-br ${c.gradient} text-white group hover:shadow-xl transition-all duration-300 cursor-pointer h-full`}>
                  <div className="text-3xl mb-3">{c.icon}</div>
                  <h3 className="font-bold text-lg mb-1">{c.label}</h3>
                  <p className="text-white/70 text-sm">{c.desc}</p>
                  <ArrowRight className="absolute bottom-4 right-4 h-5 w-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Products */}
      {!loading && latest.length > 0 && (
        <section className="py-20 bg-slate-50">
          <div className="container">
            <div className="flex items-center justify-between mb-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-indigo-500" />
                  <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Recién agregados</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight">Últimos productos</h2>
              </div>
              <Link href="/catalog">
                <Button variant="outline" className="gap-2 rounded-xl">
                  Catálogo completo <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {latest.map((product) => {
                const tags = Array.isArray((product.metadata as Record<string, unknown>)?.tags)
                  ? ((product.metadata as Record<string, unknown>).tags as string[])
                  : [];
                return (
                  <Link key={product.id} href={`/catalog/${product.slug}`}>
                    <div className="group rounded-xl overflow-hidden border hover:shadow-lg transition-all duration-300 cursor-pointer h-full flex flex-col" style={{ backgroundColor: "var(--site-card-bg, #ffffff)" }}>
                      <div className="relative h-40 bg-muted overflow-hidden">
                        {product.coverImage ? (
                          <img
                            src={product.coverImage}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                            <ImageIcon className="h-8 w-8 text-slate-300" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <Badge className={`${categoryColors[product.category] || "bg-gray-500"} text-white text-[10px]`}>
                            {categoryLabels[product.category] || product.category}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <h3 className="font-semibold text-sm group-hover:text-indigo-600 transition-colors mb-1 line-clamp-1">
                          {product.name}
                        </h3>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-auto pt-2 border-t flex items-center justify-between">
                          <span className="font-bold text-lg">${product.priceUsd}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Features / Why Choose Us */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">¿Por qué elegirnos?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Nos especializamos en productos digitales premium para servidores de Minecraft
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Zap className="h-6 w-6" />,
                title: "Entrega instantánea",
                desc: "Descarga inmediata después del pago. Sin esperas.",
                color: "bg-yellow-50 text-yellow-600 border-yellow-100",
              },
              {
                icon: <Shield className="h-6 w-6" />,
                title: "Pago seguro",
                desc: "Pagos procesados por PayPal con protección al comprador.",
                color: "bg-green-50 text-green-600 border-green-100",
              },
              {
                icon: <Star className="h-6 w-6" />,
                title: "Calidad premium",
                desc: "Productos probados y optimizados para máximo rendimiento.",
                color: "bg-purple-50 text-purple-600 border-purple-100",
              },
              {
                icon: <Download className="h-6 w-6" />,
                title: "Licencia incluida",
                desc: "Cada compra incluye licencia digital verificable.",
                color: "bg-blue-50 text-blue-600 border-blue-100",
              },
            ].map((f, i) => (
              <div key={i} className={`rounded-2xl border p-6 ${f.color} transition-all hover:shadow-md`}>
                <div className="mb-4">{f.icon}</div>
                <h3 className="font-bold text-base mb-2 text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-12 md:p-16 text-center">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0wIDZjMS42NTcgMCAzLTEuMzQzIDMtM3MtMS4zNDMtMy0zLTMtMyAxLjM0My0zIDMgMS4zNDMgMyAzIDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                ¿Listo para mejorar tu servidor?
              </h2>
              <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
                Explora nuestra colección completa y lleva tu servidor de Minecraft al siguiente nivel.
              </p>
              <Link href="/catalog">
                <Button size="lg" className="h-13 px-10 text-base font-semibold bg-white text-indigo-700 hover:bg-white/90 rounded-xl gap-2">
                  Explorar catálogo <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
