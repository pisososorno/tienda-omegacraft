# SEO v1 — tienda.omegacraft.cl

## Resumen

Implementación SEO técnica completa para Next.js standalone. Cubre metadata, schemas, canonical, redirects, sitemap, robots y accesibilidad SEO.

---

## Fase 1: SEO Técnico

### 1A — Canonicalización `/home` → `/`

- **Problema**: La home real vivía en `/home` y `/` redirigía a `/home`, generando contenido duplicado.
- **Solución**:
  - `next.config.mjs` → `redirects()`: 301 de `/home` → `/`
  - `next.config.mjs` → `rewrites().beforeFiles`: `/` sirve el contenido de `/home` internamente
  - `src/app/page.tsx`: fallback que redirige a `/home` si el rewrite no aplica
- **Canonical**: `<link rel="canonical" href="https://tienda.omegacraft.cl/" />` via `alternates.canonical` en `layout.tsx`

### 1B — Metadata Base

- **Archivo**: `src/app/layout.tsx`
- `metadataBase`: `new URL(APP_URL)` — resuelve URLs relativas en OG/Twitter
- `title.template`: `%s | StoreName`
- `description`: Descripción global optimizada
- `keywords`: Lista de keywords de Minecraft
- `openGraph`: type, locale, siteName, title, description, url
- `twitter`: card summary_large_image
- `robots`: index, follow, googleBot con max-image-preview large
- `alternates.canonical`: `/`

### 1C — robots.txt + sitemap.xml

- **`src/app/robots.ts`**: Genera `/robots.txt` dinámicamente
  - Allow: `/`
  - Disallow: `/admin`, `/api/`, `/checkout`, `/my-downloads`
  - Sitemap: `{APP_URL}/sitemap.xml`

- **`src/app/sitemap.ts`**: Genera `/sitemap.xml` dinámicamente
  - Páginas estáticas: `/`, `/catalog`, `/terms`, `/privacy`
  - Categorías: `/catalog?category={cat}` para maps, plugins, configurations, source_code
  - Productos: `/catalog/{slug}` con `lastModified` desde DB

### 1D — Accesibilidad SEO

- ALT descriptivos en todas las imágenes (home, catálogo, producto)
- H1 único por página
- `aria-label` en breadcrumbs y botones de navegación de galería
- Anchor text descriptivo en enlaces

---

## Fase 2: Schema.org (JSON-LD)

### 2A — Organization + WebSite (global)

- **Archivo**: `src/app/(public)/layout.tsx`
- Inyecta `<script type="application/ld+json">` con:
  - `Organization`: name, url, logo, contactPoint
  - `WebSite`: name, url, potentialAction SearchAction → `/catalog?query={search_term_string}`

### 2B — BreadcrumbList

- **Catálogo** (`src/app/(public)/catalog/page.tsx`): Inicio → Catálogo
- **Producto** (`src/app/(public)/catalog/[slug]/page.tsx`): Inicio → Catálogo → Categoría → Producto

### 2C — Product Schema

- **Archivo**: `src/app/(public)/catalog/[slug]/page.tsx`
- Genera JSON-LD con: name, description, image[], brand, sku, url, category, offers (price, currency, availability, seller)

### 2D — ItemList Schema

- **Archivo**: `src/app/(public)/catalog/page.tsx`
- Lista de productos con position, url, name

### Helper: `src/lib/seo.ts`

Funciones exportadas:
- `organizationSchema(storeName, logoUrl?)`
- `webSiteSchema(storeName)`
- `breadcrumbSchema(items[])`
- `productSchema(input)`
- `itemListSchema(items[], listName?)`
- `jsonLd(schema)` — serializa a JSON string
- Constantes: `SEO_CATEGORY_LABELS`, `SEO_CATEGORY_DESCRIPTIONS`, `SEO_CATEGORY_TITLES`

---

## Fase 3: Metadata Dinámica

### 3A — Por página

| Página | Title | Description | Canonical |
|--------|-------|-------------|-----------|
| `/` | `{storeName} — {slogan}` | Global | `/` |
| `/catalog` | `Catálogo — Plugins, Mapas y Configs para Minecraft` | Dinámico con storeName | `/catalog` |
| `/catalog/{slug}` | `{productName} — {categoryLabel}` | shortDescription o fallback | `/catalog/{slug}` |
| `/terms` | `Términos y Condiciones \| {storeName}` | Dinámico | (hereda) |
| `/privacy` | `Política de Privacidad \| {storeName}` | Dinámico | (hereda) |

### 3B — OG/Twitter por producto

- `og:title`: `{productName} | {storeName}`
- `og:description`: shortDescription (max 160 chars)
- `og:image`: Imagen primaria del producto
- `og:url`: `/catalog/{slug}`
- `twitter:card`: `summary_large_image`
- `twitter:image`: Imagen primaria

---

## Fase 4: Programmatic SEO (pendiente)

Landing pages por intención de búsqueda: `/catalog/{category}/{tag}` con contenido útil, H1 único, schemas y enlaces internos.

---

## Validación

```bash
# Verificar redirect 301
curl -sI https://tienda.omegacraft.cl/home | head -5

# Verificar canonical
curl -s https://tienda.omegacraft.cl/ | grep canonical

# Verificar robots.txt
curl https://tienda.omegacraft.cl/robots.txt

# Verificar sitemap.xml
curl https://tienda.omegacraft.cl/sitemap.xml

# Verificar JSON-LD
curl -s https://tienda.omegacraft.cl/ | grep -o 'application/ld+json'

# Google Rich Results Test
# https://search.google.com/test/rich-results?url=https://tienda.omegacraft.cl/catalog/{slug}

# Lighthouse SEO audit
# Chrome DevTools → Lighthouse → SEO
```

---

## Archivos modificados/creados

| Archivo | Acción |
|---------|--------|
| `next.config.mjs` | Modificado — redirects + rewrites |
| `src/app/page.tsx` | Modificado — fallback |
| `src/app/layout.tsx` | Modificado — metadataBase, alternates, OG url |
| `src/app/robots.ts` | **Nuevo** |
| `src/app/sitemap.ts` | **Nuevo** |
| `src/lib/seo.ts` | **Nuevo** — helpers de schema |
| `src/app/(public)/layout.tsx` | Modificado — JSON-LD global |
| `src/app/(public)/catalog/page.tsx` | Modificado → server component + generateMetadata + ItemList |
| `src/app/(public)/catalog/catalog-client.tsx` | **Nuevo** — UI client del catálogo |
| `src/app/(public)/catalog/[slug]/page.tsx` | Modificado → server component + generateMetadata + Product schema |
| `src/app/(public)/catalog/[slug]/product-client.tsx` | **Nuevo** — UI client del producto |
| `src/app/(public)/home/page.tsx` | Modificado — ALT descriptivos |
| `docs/seo-v1.md` | **Nuevo** — esta documentación |

---

## Variables de entorno requeridas

- `APP_URL`: URL base del sitio (ej: `https://tienda.omegacraft.cl`). Fallback: `http://localhost:3000`
