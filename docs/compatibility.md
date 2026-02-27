# Compatibilidad de Productos — Versiones Minecraft y Plataformas

## Modelo de datos

### Campos en `Product` (Prisma)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `minecraftVersionMin` | `String?` | Versión mínima soportada (ej: `"1.16"`) |
| `minecraftVersionMax` | `String?` | Versión máxima soportada (ej: `"1.20.4"`) |
| `supportedVersions` | `String[]` | Lista exacta de versiones soportadas (ej: `["1.20.1","1.20.2","1.20.4"]`) |
| `platforms` | `String[]` | Plataformas compatibles (ej: `["Paper","Spigot"]`) |

### Reglas de prioridad

1. Si `supportedVersions` tiene valores → **fuente de verdad** para versiones exactas.
2. Si `supportedVersions` está vacío → se usa rango `minecraftVersionMin`–`minecraftVersionMax`.
3. Si solo hay `minecraftVersionMin` (sin max) → producto es single-version.
4. Si todo está vacío → producto no tiene info de compatibilidad (se muestra sin badges).

### Plataformas permitidas

Valores normalizados en TitleCase:
- `Paper`
- `Spigot`
- `Bukkit`
- `Fabric`
- `Forge`
- `Geyser`

Definidos en `src/lib/compatibility.ts` → `PLATFORMS`.

---

## Formato recomendado por tipo de producto

### Plugins
- **supportedVersions**: Lista las versiones exactas probadas (ej: `["1.20.1", "1.20.4", "1.21"]`)
- **platforms**: Típicamente `["Paper", "Spigot"]` o `["Fabric"]`
- **min/max**: Opcional como fallback

### Maps
- **minecraftVersionMin/Max**: Rango amplio (ej: `1.16`–`1.21`)
- **platforms**: Generalmente vacío (mapas son agnósticos de plataforma)
- **supportedVersions**: Opcional

### Configurations
- **supportedVersions**: Versiones específicas del plugin objetivo
- **platforms**: La plataforma del plugin (ej: `["Paper"]`)

### Source Code
- **supportedVersions**: Versiones donde fue compilado/probado
- **platforms**: Framework objetivo (ej: `["Paper", "Spigot"]`)

---

## Motor de filtrado

### API pública (`GET /api/products`)

Query params:
- `version` — filtra por versión de MC
- `platform` — filtra por plataforma

**Lógica de filtrado de versión:**
1. Si el producto tiene `supportedVersions` → match exacto o prefijo (ej: `1.20` matchea `1.20.1`)
2. Si tiene rango `min`/`max` → comparación semver simple
3. Si no tiene datos de versión → **se incluye** (no penalizar productos sin info)

**Lógica de filtrado de plataforma:**
- Prisma `{ has: "Paper" }` sobre el array `platforms`
- Case-insensitive en input (normalizado a TitleCase)

### URL patterns del catálogo

```
/catalog                              → todos los productos
/catalog?category=plugins             → solo plugins
/catalog?version=1.20.4               → MC 1.20.4
/catalog?platform=Paper               → solo Paper
/catalog?category=plugins&version=1.20&platform=Paper  → combinación
```

Los filtros actualizan la URL (indexable) pero por defecto las combinaciones infinitas **no se indexan**. La Fase 4 (programmatic SEO) creará landing pages curadas.

---

## UI

### Admin — Edición de producto (`/admin/products/[id]/edit`)

Sección "Compatibilidad Minecraft":
- **Versiones soportadas**: Chips seleccionables con presets comunes
- **Versión mínima/máxima**: Dropdowns como alternativa
- **Plataformas**: Checkboxes con labels visuales

### Admin — Tabla de productos

Columna "Compatibilidad" con badges:
- Badge verde: `MC 1.20.1–1.20.4` (versión)
- Badge gris: `Paper`, `Spigot` (plataformas)

### Catálogo público

**Cards**: Badges pequeños debajo de la descripción:
- Verde: `MC 1.20.1–1.20.4`
- Azul: `Paper`, `Spigot`

**Filtros**: Dropdowns de versión y plataforma arriba de la grilla.

### Página de producto

Bloque "Compatibilidad" en sidebar:
- Lista completa de versiones soportadas (chips individuales)
- Lista de plataformas

---

## Archivos involucrados

| Archivo | Descripción |
|---------|-------------|
| `prisma/schema.prisma` | Campos `minecraftVersionMin`, `minecraftVersionMax`, `supportedVersions`, `platforms` |
| `src/lib/compatibility.ts` | Constantes (`MC_VERSION_PRESETS`, `PLATFORMS`), helpers (`formatVersionLabel`, `compareMcVersion`) |
| `src/app/api/products/route.ts` | Filtrado por `version` y `platform` en API pública |
| `src/app/api/admin/products/route.ts` | POST con campos de compatibilidad |
| `src/app/api/admin/products/[id]/route.ts` | GET/PUT con campos de compatibilidad |
| `src/app/api/products/[slug]/route.ts` | Expone compatibilidad en detalle público |
| `src/app/admin/products/[id]/edit/page.tsx` | UI de edición con sección compatibilidad |
| `src/app/admin/products/page.tsx` | Badges en tabla admin |
| `src/app/(public)/catalog/catalog-client.tsx` | Badges en cards + filtros versión/plataforma |
| `src/app/(public)/catalog/[slug]/product-client.tsx` | Bloque compatibilidad en sidebar |
| `src/lib/seo.ts` | Branding: `BRAND_LEGAL_NAME`, `BRAND_STORE_NAME` |

---

## Preparación para Fase 4 (Programmatic SEO)

El motor de filtrado por `version` + `platform` está listo. La Fase 4 creará landing pages estáticas tipo:
- `/catalog/plugins/paper-1-20`
- `/catalog/maps/1-20-spawn`

Estas usarán los mismos query params internamente y `generateStaticParams` para pre-renderizar.
