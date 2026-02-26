# SEO v1.1 — HOTFIX

Cambios pequeños, impacto grande. Limpieza técnica SEO antes de Fase 4 programmatic.

---

## Cambios realizados

### 1. Schema Visibility (CRÍTICO)

**Problema**: JSON-LD se inyectaba en `<body>` via public layout — algunas extensiones SEO no lo detectaban.

**Fix**: Movidos Organization + WebSite JSON-LD al `<head>` del root layout (`src/app/layout.tsx`), garantizando visibilidad en View Source.

**Archivos**:
- `src/app/layout.tsx` — JSON-LD en `<head>`
- `src/app/(public)/layout.tsx` — Removidos scripts duplicados

**Validación**:
```
View Page Source → buscar "application/ld+json"
Debe encontrar: Organization + WebSite (en <head>)
```

### 2. NOINDEX en rutas sensibles

**Fix**: Doble capa de protección:
- `next.config.mjs` → `headers()` con `X-Robots-Tag: noindex, nofollow` para `/admin/*`, `/my-downloads`, `/checkout/*`, `/api/*`
- Layouts con `metadata.robots: { index: false, follow: false }` para `/my-downloads` y `/checkout`

**Archivos**:
- `next.config.mjs` — headers()
- `src/app/(public)/my-downloads/layout.tsx` — **Nuevo**
- `src/app/(public)/checkout/layout.tsx` — **Nuevo**

**Validación**:
```bash
curl -sI https://tienda.omegacraft.cl/my-downloads | grep -i x-robots
# → X-Robots-Tag: noindex, nofollow

curl -sI https://tienda.omegacraft.cl/checkout | grep -i x-robots
# → X-Robots-Tag: noindex, nofollow
```
Confirmar que estas URLs NO aparecen en `/sitemap.xml`.

### 3. Meta Description (home) <= 160 chars

**Antes** (163 chars):
> Tienda de productos digitales premium para servidores de Minecraft. Plugins, mapas, configuraciones y source code con entrega instantánea y pago seguro por PayPal.

**Después** (128 chars):
> Productos digitales premium para Minecraft: plugins, mapas, configs y source code. Entrega instantánea y pago seguro por PayPal.

**Archivo**: `src/app/layout.tsx`

**Validación**: Extensión SEO ya no marca rojo por longitud.

### 4. ALT de imágenes

| Imagen | ALT anterior | ALT nuevo |
|--------|-------------|-----------|
| Hero bg (custom) | `""` | `""` + `aria-hidden="true"` |
| Hero bg (default SVG) | `""` | `""` + `aria-hidden="true"` |
| Navbar logo | `{storeName}` ✓ | Sin cambio |
| Footer logo | `{storeName}` ✓ | Sin cambio |
| Cards home (featured) | `{name} — {cat} para Minecraft` ✓ | Sin cambio |
| Cards home (latest) | `{name} — producto digital para Minecraft` ✓ | Sin cambio |
| Cards catálogo | `{name} — producto digital para Minecraft` ✓ | Sin cambio |
| Producto galería | `{altText} \|\| {name} — imagen N` ✓ | Sin cambio |
| Producto thumbnails | `{altText} \|\| {name} — miniatura N` ✓ | Sin cambio |

**Regla**: Imágenes decorativas → `alt="" aria-hidden="true"`. Imágenes con contenido → ALT descriptivo.

**Archivo**: `src/app/(public)/home/page.tsx`

### 5. Links con title="/"

**Causa**: Algunas extensiones SEO interpretan `<a href="/">` sin `title` explícito y reportan `title="/"`.

**Fix**: Agregado `title={storeName}` y `aria-label` al link del logo en navbar.

**Archivo**: `src/components/layout/navbar.tsx`

### 6. Publisher

**Fix**: Agregado `publisher` (tipo Organization) al schema WebSite.

**Archivo**: `src/lib/seo.ts`

### 7. Mejoras adicionales al footer

- Links de categorías ahora apuntan a URLs reales (`/catalog?category=plugins`, etc.) en vez de todos a `/catalog`
- Link "Mis Descargas" tiene `rel="nofollow"` (tanto en navbar como footer)
- Anchor text más descriptivo ("Catálogo completo", "Plugins para Minecraft", etc.)

**Archivo**: `src/app/(public)/layout.tsx`

---

## Checklist de validación completa

### View Source
- [ ] `<head>` contiene `<script type="application/ld+json">` con Organization
- [ ] `<head>` contiene `<script type="application/ld+json">` con WebSite + publisher
- [ ] `<meta name="description">` tiene <= 160 caracteres
- [ ] `<meta name="publisher">` presente
- [ ] No hay `<link rel="canonical">` duplicados

### Google Rich Results Test
- [ ] Home (`/`): WebSite + Organization detectados
- [ ] Producto (`/catalog/{slug}`): Product + BreadcrumbList detectados
- [ ] Catálogo (`/catalog`): ItemList + BreadcrumbList detectados

### Robots / Indexación
- [ ] `/robots.txt` → Disallow /admin, /api/, /checkout, /my-downloads
- [ ] `/sitemap.xml` → Solo contiene /, /catalog, /catalog/{slug}, /terms, /privacy
- [ ] `/my-downloads` → X-Robots-Tag: noindex, nofollow + meta robots noindex
- [ ] `/checkout` → X-Robots-Tag: noindex, nofollow + meta robots noindex
- [ ] `/admin` → X-Robots-Tag: noindex, nofollow

### Imágenes
- [ ] Extensión SEO: "images without alt" = 0 (o solo decorativas con aria-hidden)
- [ ] Hero background: alt="" aria-hidden="true"
- [ ] Product cards: ALT descriptivo con nombre + categoría

### Links
- [ ] No hay anchors con title="/" en View Source
- [ ] Logo link tiene title={storeName}
- [ ] Footer links de categorías apuntan a URLs con ?category=
- [ ] my-downloads link tiene rel="nofollow"

### TypeScript
- [ ] `npx tsc --noEmit` → 0 errores

---

## Archivos modificados/creados

| Archivo | Acción |
|---------|--------|
| `next.config.mjs` | Modificado — headers() X-Robots-Tag |
| `src/app/layout.tsx` | Modificado — JSON-LD en head, description <=160, publisher |
| `src/app/(public)/layout.tsx` | Modificado — removidos JSON-LD duplicados, footer mejorado |
| `src/lib/seo.ts` | Modificado — publisher en WebSite schema |
| `src/components/layout/navbar.tsx` | Modificado — title/aria-label en home link, nofollow en my-downloads |
| `src/app/(public)/home/page.tsx` | Modificado — aria-hidden en hero bg images |
| `src/app/(public)/my-downloads/layout.tsx` | **Nuevo** — metadata noindex |
| `src/app/(public)/checkout/layout.tsx` | **Nuevo** — metadata noindex |
| `docs/seo-v1_1.md` | **Nuevo** — esta documentación |
