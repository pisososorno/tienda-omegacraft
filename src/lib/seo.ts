/**
 * SEO helpers — JSON-LD schema generators for structured data.
 * Used across pages to provide rich results to Google.
 */

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// ── Category labels (SEO-friendly) ─────────────────────────
export const SEO_CATEGORY_LABELS: Record<string, string> = {
  maps: "Mapas para Minecraft",
  plugins: "Plugins para Minecraft",
  configurations: "Configuraciones para Minecraft",
  source_code: "Source Code para Minecraft",
};

export const SEO_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  maps: "Mapas premium para servidores de Minecraft — spawns, lobbies, dungeons y más. Descarga instantánea con licencia incluida.",
  plugins: "Plugins premium para servidores Minecraft Paper y Spigot. Funcionalidades únicas con entrega instantánea y soporte.",
  configurations: "Packs de configuración listos para usar en tu servidor Minecraft. Setup profesional con entrega instantánea.",
  source_code: "Código fuente completo para servidores Minecraft. Economías, sistemas PvP y más. Entrega instantánea.",
};

export const SEO_CATEGORY_TITLES: Record<string, string> = {
  maps: "Mapas para Minecraft — Spawns, Lobbies y Dungeons",
  plugins: "Plugins para Minecraft — Paper/Spigot",
  configurations: "Configuraciones para Minecraft — Setup Profesional",
  source_code: "Source Code para Minecraft — Código Fuente Completo",
};

// ── Organization schema ─────────────────────────────────────
export function organizationSchema(storeName: string, logoUrl?: string | null) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: storeName,
    url: APP_URL,
    ...(logoUrl ? { logo: logoUrl.startsWith("http") ? logoUrl : `${APP_URL}${logoUrl}` } : {}),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: ["Spanish", "English"],
    },
  };
}

// ── WebSite schema + SearchAction ───────────────────────────
export function webSiteSchema(storeName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: storeName,
    url: APP_URL,
    publisher: {
      "@type": "Organization",
      name: storeName,
      url: APP_URL,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${APP_URL}/catalog?query={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ── BreadcrumbList schema ───────────────────────────────────
export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${APP_URL}${item.url}`,
    })),
  };
}

// ── Product schema ──────────────────────────────────────────
export interface ProductSchemaInput {
  name: string;
  description: string;
  slug: string;
  priceUsd: string;
  category: string;
  imageUrls: string[];
  sku?: string;
  inStock?: boolean;
}

export function productSchema(p: ProductSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.imageUrls.map((u) => (u.startsWith("http") ? u : `${APP_URL}${u}`)),
    brand: {
      "@type": "Brand",
      name: "OmegaCraft",
    },
    sku: p.sku || p.slug,
    url: `${APP_URL}/catalog/${p.slug}`,
    category: SEO_CATEGORY_LABELS[p.category] || p.category,
    offers: {
      "@type": "Offer",
      price: p.priceUsd,
      priceCurrency: "USD",
      availability: p.inStock !== false
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${APP_URL}/catalog/${p.slug}`,
      seller: {
        "@type": "Organization",
        name: "OmegaCraft",
      },
    },
  };
}

// ── ItemList schema (for catalog / category pages) ──────────
export interface ItemListProduct {
  name: string;
  slug: string;
  position: number;
}

export function itemListSchema(items: ItemListProduct[], listName?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName || "Catálogo de productos",
    numberOfItems: items.length,
    itemListElement: items.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      url: `${APP_URL}/catalog/${item.slug}`,
      name: item.name,
    })),
  };
}

// ── Helper: render JSON-LD as script tag content ────────────
export function jsonLd(schema: Record<string, unknown>): string {
  return JSON.stringify(schema);
}
