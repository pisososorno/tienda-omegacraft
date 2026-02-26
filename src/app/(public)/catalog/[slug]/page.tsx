import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  productSchema,
  breadcrumbSchema,
  jsonLd,
  SEO_CATEGORY_LABELS,
} from "@/lib/seo";
import ProductPageClient from "./product-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { storeName } = await getSettings();

  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    select: {
      name: true,
      shortDescription: true,
      category: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
  });

  if (!product) {
    return { title: "Producto no encontrado" };
  }

  const catLabel = SEO_CATEGORY_LABELS[product.category] || product.category;
  const title = `${product.name} — ${catLabel}`;
  const description =
    product.shortDescription ||
    `${product.name} — producto digital premium para Minecraft. Entrega instantánea.`;

  const imageUrl = product.images[0]?.storageKey
    ? product.images[0].storageKey.startsWith("/") || product.images[0].storageKey.startsWith("http")
      ? product.images[0].storageKey
      : `/${product.images[0].storageKey}`
    : undefined;

  return {
    title,
    description: description.slice(0, 160),
    alternates: {
      canonical: `/catalog/${slug}`,
    },
    openGraph: {
      title: `${product.name} | ${storeName}`,
      description: description.slice(0, 160),
      type: "website",
      url: `/catalog/${slug}`,
      ...(imageUrl ? { images: [{ url: imageUrl, alt: product.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | ${storeName}`,
      description: description.slice(0, 160),
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;

  // Fetch product data server-side for JSON-LD (client component re-fetches for interactivity)
  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    select: {
      name: true,
      slug: true,
      shortDescription: true,
      description: true,
      category: true,
      priceUsd: true,
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!product) {
    return <ProductPageClient />;
  }

  const imageUrls = product.images.map((img: { storageKey: string }) =>
    img.storageKey.startsWith("/") || img.storageKey.startsWith("http")
      ? img.storageKey
      : `/${img.storageKey}`
  );

  const catLabel = SEO_CATEGORY_LABELS[product.category] || product.category;

  const prodSchema = productSchema({
    name: product.name,
    description: product.shortDescription || product.description.slice(0, 300),
    slug: product.slug,
    priceUsd: product.priceUsd.toString(),
    category: product.category,
    imageUrls,
    inStock: true,
  });

  const breadcrumbs = breadcrumbSchema([
    { name: "Inicio", url: "/" },
    { name: "Catálogo", url: "/catalog" },
    { name: catLabel, url: `/catalog?category=${product.category}` },
    { name: product.name, url: `/catalog/${product.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(prodSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <ProductPageClient />
    </>
  );
}
