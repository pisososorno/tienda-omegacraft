import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  itemListSchema,
  breadcrumbSchema,
  jsonLd,
} from "@/lib/seo";
import CatalogPageClient from "./catalog-client";

export async function generateMetadata(): Promise<Metadata> {
  const { storeName } = await getSettings();
  return {
    title: `Catálogo — Plugins, Mapas y Configs para Minecraft`,
    description:
      `Explora el catálogo completo de ${storeName}. Plugins, mapas, configuraciones y source code premium para servidores de Minecraft con entrega instantánea.`,
    alternates: {
      canonical: "/catalog",
    },
    openGraph: {
      title: `Catálogo | ${storeName}`,
      description:
        "Plugins, mapas, configs y source code premium para Minecraft. Entrega instantánea.",
      url: "/catalog",
    },
  };
}

export default async function CatalogPage() {
  // Fetch products server-side for ItemList JSON-LD
  let products: { name: string; slug: string }[] = [];
  try {
    products = await prisma.product.findMany({
      where: { isActive: true },
      select: { name: true, slug: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("[catalog] DB error for schema:", err);
  }

  const listSchema = itemListSchema(
    products.map((p, i) => ({ name: p.name, slug: p.slug, position: i + 1 })),
    "Catálogo de productos"
  );

  const breadcrumbs = breadcrumbSchema([
    { name: "Inicio", url: "/" },
    { name: "Catálogo", url: "/catalog" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(listSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <CatalogPageClient />
    </>
  );
}
