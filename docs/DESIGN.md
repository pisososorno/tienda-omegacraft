# FASE 2 — DISEÑO TÉCNICO COMPLETO
## Tienda Digital Minecraft + Motor Forense Anti-Chargeback

---

## A) ARQUITECTURA FINAL

### Decisión: Next.js API Routes (monolito)

**Justificación:** Un solo deploy, un solo repo, sin overhead de comunicación entre servicios. El volumen de ventas no justifica microservicios. Next.js App Router maneja SSR para SEO del catálogo + API Routes para lógica de negocio + admin panel en el mismo proyecto.

### Diagrama de módulos

```
┌─────────────────────────────────────────────────────────┐
│                    NEXT.JS APP (App Router)              │
├──────────────┬──────────────┬───────────────────────────┤
│  PUBLIC WEB  │  API ROUTES  │      ADMIN PANEL          │
│              │              │   (auth: NextAuth)         │
│ /store/*     │ /api/checkout│   /admin/orders            │
│ /product/*   │ /api/webhook │   /admin/products          │
│ /download/*  │ /api/download│   /admin/evidence          │
│ /terms       │ /api/orders  │   /admin/terms             │
│ /thankyou    │ /api/admin/* │                            │
└──────┬───────┴──────┬───────┴────────────┬──────────────┘
       │              │                    │
       │     ┌────────▼─────────┐          │
       │     │   MIDDLEWARE      │          │
       │     │ - Rate Limiter    │          │
       │     │ - IP/UA Capture   │          │
       │     │ - HMAC Validator  │          │
       │     │ - Auth Guard      │          │
       │     └────────┬─────────┘          │
       │              │                    │
  ┌────▼──────────────▼────────────────────▼──┐
  │              LIB / SERVICES                │
  │                                            │
  │  paypal.ts    — Orders API v2 + Webhooks   │
  │  tokens.ts    — HMAC sign/verify           │
  │  hashing.ts   — SHA256 de archivos         │
  │  storage.ts   — S3/R2 upload/download      │
  │  watermark.ts — Pipeline licensing/wm      │
  │  evidence.ts  — Generación PDF             │
  │  mailer.ts    — Emails transaccionales     │
  │  forensic.ts  — Event logger (tamper-chain)│
  │  geoip.ts     — Geolocalización IP         │
  │  snapshot.ts  — Product page snapshot (B)  │
  │  stages.ts    — Stage delivery pipeline (F)│
  │  privacy.ts   — IP mask/encrypt/decrypt (I)│
  │  dispute.ts   — Freeze + evidence pack (J) │
  └────────────────────┬──────────────────────┘
                       │
          ┌────────────▼────────────┐
          │     PRISMA ORM          │
          │     PostgreSQL          │
          │  (append-only events)   │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │   Cloudflare R2 / S3    │
          │   (archivos privados)   │
          └─────────────────────────┘
```

### Flujo principal (compra completa)

```
1. Buyer → /store/[category] → /product/[slug]
2. Buyer acepta términos (checkbox) → se registra: terms_version, IP, UA, timestamp
3. Buyer hace clic "Pay with PayPal"
4. Frontend → POST /api/checkout/create-order → server crea PayPal Order
5. PayPal Checkout popup → buyer aprueba
6. Frontend → POST /api/checkout/capture-order → server captura pago
7. Server guarda: order + payment + product_snapshot + terms_acceptance
8. Server genera delivery_package (watermark si source-code) + SHA256
9. Server habilita descargas (download_token con límites)
10. Buyer → /thankyou/[orderId] → ve resumen + enlace a descargas
11. Buyer → /download/[token] → servidor valida, sirve archivo, registra evento
12. Webhook PAYMENT.CAPTURE.COMPLETED llega → server marca confirmed (idempotente)
13. Admin → /admin/orders/[id] → ve timeline → Export Evidence PDF
```

---

## B) MODELO DE DATOS PostgreSQL

### Tablas principales

#### `products`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| slug | VARCHAR(255) UNIQUE | URL-friendly |
| name | VARCHAR(500) | |
| description | TEXT | Markdown |
| category | ENUM('configurations','source-code','maps') | |
| price_usd | DECIMAL(10,2) | |
| metadata | JSONB | {mc_versions, platforms, tags, changelog} |
| is_active | BOOLEAN | default true |
| download_limit | INT | default 3 |
| download_expires_days | INT | default 7 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `product_files`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| product_id | UUID FK → products | |
| filename | VARCHAR(500) | nombre original |
| storage_key | VARCHAR(1000) | key en S3/R2 |
| file_size | BIGINT | bytes |
| sha256_hash | VARCHAR(64) | hash del archivo original |
| file_type | VARCHAR(100) | zip, jar, schematic, etc |
| is_primary | BOOLEAN | archivo principal de entrega |
| created_at | TIMESTAMPTZ | |

#### `product_images`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| product_id | UUID FK → products | |
| storage_key | VARCHAR(1000) | key en S3/R2 (bucket público) |
| alt_text | VARCHAR(500) | |
| sort_order | INT | |
| created_at | TIMESTAMPTZ | |

#### `terms_versions`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| version_label | VARCHAR(50) | ej: "v1.0", "v2.0" |
| content | TEXT | texto completo de los términos |
| content_hash | VARCHAR(64) | SHA256 del contenido |
| is_active | BOOLEAN | solo 1 activa a la vez |
| published_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

#### `orders`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| order_number | VARCHAR(20) UNIQUE | formato: ORD-XXXXXX (human-readable) |
| product_id | UUID FK → products | |
| product_snapshot | JSONB | copia inmutable del producto al comprar |
| buyer_email | VARCHAR(500) | email del pagador PayPal |
| buyer_ip | VARCHAR(45) | IPv4/IPv6 |
| buyer_user_agent | TEXT | |
| buyer_country | VARCHAR(100) | geolocalización de IP |
| buyer_city | VARCHAR(200) | geolocalización de IP |
| amount_usd | DECIMAL(10,2) | |
| currency | VARCHAR(3) | default 'USD' |
| status | ENUM('pending','paid','confirmed','refunded','disputed','revoked') | |
| paypal_order_id | VARCHAR(100) | |
| paypal_capture_id | VARCHAR(100) | |
| paypal_payer_id | VARCHAR(100) | |
| paypal_payer_email | VARCHAR(500) | email de la cuenta PayPal |
| paypal_status | VARCHAR(50) | |
| paypal_raw_capture | JSONB | respuesta completa de PayPal |
| paypal_webhook_received_at | TIMESTAMPTZ | |
| download_limit | INT | copia del límite al momento de compra |
| download_count | INT | default 0 |
| downloads_expire_at | TIMESTAMPTZ | |
| downloads_revoked | BOOLEAN | default false |
| terms_version_id | UUID FK → terms_versions | |
| terms_accepted_at | TIMESTAMPTZ | |
| terms_accepted_ip | VARCHAR(45) | |
| terms_accepted_ua | TEXT | |
| delivery_package_key | VARCHAR(1000) | key del ZIP personalizado en S3 |
| delivery_package_hash | VARCHAR(64) | SHA256 del ZIP entregado |
| delivery_package_generated_at | TIMESTAMPTZ | |
| buyer_ip_encrypted | BYTEA | AES-256-GCM del IP completo (I) |
| terms_accepted_ip_encrypted | BYTEA | AES-256-GCM del IP completo (I) |
| evidence_frozen_at | TIMESTAMPTZ | timestamp de congelación de evidencia (J) |
| evidence_frozen_by_admin | VARCHAR(500) | email del admin que congeló (J) |
| frozen_evidence_pdf_key | VARCHAR(1000) | S3 key del PDF final congelado (J) |
| retention_expires_at | TIMESTAMPTZ | default: created_at + 540 días (I) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `order_events` (APPEND-ONLY, TAMPER-EVIDENT CHAIN — NUNCA UPDATE/DELETE)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| order_id | UUID FK → orders | |
| sequence_number | INT | monotónico por order_id, empieza en 1 |
| event_type | VARCHAR(100) | ver lista abajo |
| event_data | JSONB | payload variable por tipo |
| ip_address | VARCHAR(45) | **enmascarado** en vistas (ej: 190.xxx.xxx.xxx) |
| ip_encrypted | BYTEA | AES-256-GCM del IP completo (solo accesible en dispute mode) |
| user_agent | TEXT | |
| external_ref | VARCHAR(200) | paypal_event_id, capture_id, etc. Liga webhook ↔ evento |
| prev_hash | VARCHAR(64) | SHA256 del evento anterior en la cadena (NULL para el primero) |
| event_hash | VARCHAR(64) | SHA256(order_id+seq+type+data+prev_hash+created_at) |
| created_at | TIMESTAMPTZ | default NOW() |

**Hash chain algorithm:**
```
event_hash = SHA256(
  order_id + "|" +
  sequence_number + "|" +
  event_type + "|" +
  JSON.stringify(event_data) + "|" +
  (prev_hash || "GENESIS") + "|" +
  created_at.toISOString()
)
```
**Unique constraint:** `(order_id, sequence_number)` — garantiza cadena monotónica por orden.

**event_type values:**
- `order.created`
- `terms.accepted`
- `paypal.order_created`
- `paypal.capture_completed`
- `paypal.webhook_received`
- `payment.confirmed`
- `delivery.package_generated`
- `delivery.watermark_applied`
- `delivery.stage_released` (F)
- `delivery.stage_revoked` (F)
- `email.sent`
- `email.delivery_confirmed` (H)
- `download.started`
- `download.completed`
- `download.denied_limit` (E)
- `download.denied_expired` (E)
- `download.denied_revoked` (E)
- `download.denied_frozen` (E+J)
- `download.access_page_viewed` (H — proof buyer accessed "My Downloads")
- `admin.downloads_revoked`
- `admin.evidence_exported`
- `admin.stage_released` (F)
- `admin.dispute_mode_activated` (J)
- `admin.evidence_frozen` (J)
- `dispute.opened`
- `dispute.evidence_submitted`

#### `order_snapshots` (INMUTABLE — snapshot forense) (B)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| order_id | UUID FK → orders | |
| snapshot_type | VARCHAR(20) | 'json', 'html', 'pdf' |
| snapshot_json | JSONB | datos completos del producto (siempre presente) |
| snapshot_html_key | VARCHAR(1000) | S3 key del HTML renderizado de la página |
| snapshot_pdf_key | VARCHAR(1000) | S3 key del PDF de la página del producto |
| snapshot_hash | VARCHAR(64) | SHA256 del contenido principal del snapshot |
| created_at | TIMESTAMPTZ | |

**Propósito:** Capturar no solo los datos JSON, sino también cómo se veía la página del producto al momento de la compra. El HTML y PDF se generan server-side con Puppeteer al confirmar pago y se almacenan en S3. Evidencia crítica para disputas "not as described".

#### `delivery_stages` (entrega por etapas para source-code caro) (F)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| order_id | UUID FK → orders | |
| stage_type | ENUM('preview','full') | tipo de entrega |
| stage_order | INT | 1, 2, ... |
| status | ENUM('pending','ready','delivered','revoked') | |
| storage_key | VARCHAR(1000) | S3 key del archivo de esta etapa |
| sha256_hash | VARCHAR(64) | hash del archivo |
| filename | VARCHAR(500) | |
| file_size | BIGINT | |
| download_limit | INT | default 3 |
| download_count | INT | default 0 |
| released_at | TIMESTAMPTZ | cuando el admin liberó esta etapa |
| revoked_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**Unique constraint:** `(order_id, stage_order)`

**Flujo stage delivery (F):**
1. Al confirmar pago de producto source-code caro: se crean 2 stages.
2. Stage 1 (preview): JAR compilado / demo limitado → status=ready, descargable inmediatamente.
3. Stage 2 (full): source code completo → status=pending, requiere release manual del admin.
4. Admin verifica satisfacción del buyer, luego hace POST `/api/admin/orders/[id]/stages/[stageId]/release`.
5. Cada stage tiene su propio hash, límite de descargas, y logs independientes.

#### `download_tokens` (D — token NUNCA en texto plano)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| order_id | UUID FK → orders | |
| token_hash | VARCHAR(64) | SHA256(raw_token) — el token real SOLO existe en el link al buyer |
| stage_id | UUID? | FK a delivery_stages si es staged delivery (F) |
| expires_at | TIMESTAMPTZ | 15 min default |
| used | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | |

#### `licenses`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| order_id | UUID FK → orders | |
| product_id | UUID FK → products | |
| license_key | VARCHAR(100) UNIQUE | formato: LIC-XXXX-XXXX-XXXX |
| buyer_email | VARCHAR(500) | |
| fingerprint | VARCHAR(64) | hash único derivado de order+product+email+timestamp |
| status | ENUM('active','revoked','expired') | |
| metadata | JSONB | datos extra de licencia |
| created_at | TIMESTAMPTZ | |

#### `webhook_logs` (C — idempotencia por UNIQUE constraint)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| paypal_event_id | VARCHAR(200) **UNIQUE** | PayPal webhook event ID. Duplicados rechazados por DB (C) |
| event_type | VARCHAR(100) | |
| payload | JSONB | body completo |
| signature_valid | BOOLEAN | |
| processed | BOOLEAN | default false |
| processing_result | TEXT | |
| linked_order_id | VARCHAR(100) | FK a orders.id — liga webhook con orden |
| received_at | TIMESTAMPTZ | |
| processed_at | TIMESTAMPTZ | |

### Índices clave

```sql
-- products
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category);

-- orders
CREATE INDEX idx_orders_buyer_email ON orders(buyer_email);
CREATE INDEX idx_orders_paypal_order_id ON orders(paypal_order_id);
CREATE INDEX idx_orders_paypal_capture_id ON orders(paypal_capture_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- order_events (tamper-evident chain)
CREATE UNIQUE INDEX idx_order_events_chain ON order_events(order_id, sequence_number);
CREATE INDEX idx_order_events_order_id ON order_events(order_id);
CREATE INDEX idx_order_events_type ON order_events(event_type);
CREATE INDEX idx_order_events_created_at ON order_events(created_at);
CREATE INDEX idx_order_events_external_ref ON order_events(external_ref);

-- order_snapshots
CREATE INDEX idx_order_snapshots_order_id ON order_snapshots(order_id);

-- delivery_stages
CREATE UNIQUE INDEX idx_delivery_stages_order_stage ON delivery_stages(order_id, stage_order);
CREATE INDEX idx_delivery_stages_order_id ON delivery_stages(order_id);

-- download_tokens
CREATE INDEX idx_download_tokens_hash ON download_tokens(token_hash);

-- webhook_logs (idempotency)
CREATE UNIQUE INDEX idx_webhook_logs_paypal_event_id ON webhook_logs(paypal_event_id);
CREATE INDEX idx_webhook_logs_linked_order ON webhook_logs(linked_order_id);

-- licenses
CREATE INDEX idx_licenses_order_id ON licenses(order_id);
CREATE INDEX idx_licenses_license_key ON licenses(license_key);
```

---

## C) PRISMA SCHEMA

Ver archivo: `/prisma/schema.prisma`

---

## D) ENDPOINTS API

### Públicos (Store)

#### `GET /api/products`
Lista productos activos. Query params: `category`, `page`, `limit`.
```json
// Response
{
  "products": [
    {
      "id": "uuid",
      "slug": "epic-survival-spawn",
      "name": "Epic Survival Spawn",
      "category": "maps",
      "price_usd": "35.00",
      "metadata": {"mc_versions": ["1.20","1.21"], "platforms": ["Paper","Spigot"]},
      "images": [{"url": "...", "alt": "..."}]
    }
  ],
  "total": 24,
  "page": 1
}
```

#### `GET /api/products/[slug]`
Detalle de producto.
```json
// Response
{
  "id": "uuid",
  "slug": "custom-kitpvp-plugin",
  "name": "Custom KitPvP Plugin",
  "description": "## Features\n- ...",
  "category": "source-code",
  "price_usd": "450.00",
  "metadata": {
    "mc_versions": ["1.19","1.20","1.21"],
    "platforms": ["Paper"],
    "tags": ["pvp","plugin","custom"],
    "changelog": "v2.1 - Added..."
  },
  "images": [...],
  "files": [{"id": "uuid", "filename": "KitPvP-v2.1.zip", "file_type": "zip", "file_size": 2450000}],
  "download_limit": 3,
  "download_expires_days": 7
}
```

#### `GET /api/terms/active`
Retorna términos activos actuales.
```json
{
  "id": "uuid",
  "version_label": "v1.2",
  "content": "# Terms and Conditions\n...",
  "content_hash": "sha256..."
}
```

### Checkout

#### `POST /api/checkout/create-order`
Crea orden interna + PayPal Order.
```json
// Request
{
  "product_id": "uuid",
  "buyer_email": "buyer@example.com",
  "terms_version_id": "uuid",
  "terms_accepted": true
}
// Headers capturados server-side: x-forwarded-for, user-agent

// Response
{
  "order_id": "uuid",
  "order_number": "ORD-A3F8K2",
  "paypal_order_id": "5O190127TN364715T",
  "approval_url": "https://www.paypal.com/checkoutnow?token=..."
}
```

#### `POST /api/checkout/capture-order`
Captura el pago en PayPal después de aprobación del buyer.
```json
// Request
{
  "order_id": "uuid",
  "paypal_order_id": "5O190127TN364715T"
}

// Response
{
  "success": true,
  "order_number": "ORD-A3F8K2",
  "status": "paid",
  "download_url": "/download/request?order=ORD-A3F8K2&email=buyer@example.com"
}
```

**Flujo server-side del capture:**
1. Llama `POST /v2/checkout/orders/{id}/capture` a PayPal
2. Verifica status == COMPLETED
3. Guarda paypal_capture_id, payer_email, payer_id, raw_capture
4. Genera product_snapshot (copia JSON del producto)
5. Si source-code → ejecuta watermark pipeline → genera delivery package
6. Si otro tipo → copia archivo original como delivery package
7. Calcula SHA256 del delivery package
8. Actualiza orden: status=paid, hashes, delivery info
9. Registra events: paypal.capture_completed, delivery.package_generated
10. Envía email con datos de orden (sin adjuntar archivos)
11. Registra event: email.sent

### Webhook

#### `POST /api/webhook/paypal`
Recibe webhooks de PayPal. **No requiere auth propia, usa verificación de firma PayPal.**

```json
// PayPal envía:
{
  "id": "WH-XXX",
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "capture_id",
    "amount": {"currency_code": "USD", "value": "450.00"},
    "custom_id": "order_uuid"
  }
}
```

**Flujo:**
1. Verificar firma PayPal (headers: `paypal-transmission-id`, `paypal-transmission-sig`, `paypal-cert-url`, `paypal-transmission-time`, `paypal-auth-algo`)
2. Llamar POST `https://api-m.paypal.com/v1/notifications/verify-webhook-signature`
3. Check idempotencia: si `webhook_id` ya existe en `webhook_logs` → skip
4. Guardar en `webhook_logs`
5. Si event_type == PAYMENT.CAPTURE.COMPLETED:
   - Buscar orden por `custom_id` o `paypal_order_id`
   - Actualizar status → `confirmed`
   - Registrar event: `paypal.webhook_received`, `payment.confirmed`
6. Responder 200 OK

### Descargas

#### `POST /api/download/request`
Genera token de descarga firmado.
```json
// Request
{
  "order_number": "ORD-A3F8K2",
  "email": "buyer@example.com"
}
// Headers capturados: IP, UA

// Response
{
  "download_url": "/api/download/file?token=HMAC_TOKEN_BASE64",
  "expires_in": 900,
  "downloads_remaining": 2
}
```

**Validaciones:**
- Orden existe y email coincide
- status == paid o confirmed
- downloads_revoked == false
- download_count < download_limit
- NOW() < downloads_expire_at

#### `GET /api/download/file?token=XXX`
Sirve el archivo. **Stream directo desde S3/R2 con soporte Range requests (E).**

**Flujo:**
1. Decodificar token HMAC, verificar firma + expiración
2. Buscar orden (y stage si `stage_id` presente en token)
3. Validar: no revocado, no expirado, no excedido límite, no frozen (J)
4. Si falla → registrar event con result code específico (E):
   - `download.denied_limit` → `{result: "DENIED_LIMIT", count: N, limit: M}`
   - `download.denied_expired` → `{result: "DENIED_EXPIRED", expired_at: "..."}`
   - `download.denied_revoked` → `{result: "DENIED_REVOKED"}`
   - `download.denied_frozen` → `{result: "DENIED_FROZEN", frozen_at: "..."}`
   - Responder 403 con error code
5. Si ok:
   - Incrementar `download_count` (en order o en stage según corresponda)
   - Registrar event: `download.started` (pre-stream) con `{ip, ua, file_hash, stage_id?}`
   - **Soporte Range requests (E):**
     - Leer header `Range: bytes=X-Y`
     - Si presente: responder 206 Partial Content con `Content-Range` header
     - Si no: responder 200 con stream completo
   - Stream archivo desde S3/R2 con `GetObject` + `Range` param
   - Al completar: registrar event: `download.completed` con `{bytes_sent, duration_ms, result: "OK"}`
   - Headers: `Content-Disposition: attachment`, `Content-Type`, `Content-Length`, `Accept-Ranges: bytes`

### Admin (protegidos por NextAuth)

#### `GET /api/admin/orders`
Lista órdenes con filtros.
```
Query: ?page=1&limit=20&status=confirmed&email=&product_id=&from=&to=
```

#### `GET /api/admin/orders/[id]`
Detalle de orden + timeline completa.
```json
{
  "order": { /* todos los campos */ },
  "events": [
    {"event_type": "order.created", "created_at": "...", "event_data": {...}},
    {"event_type": "terms.accepted", "created_at": "...", "event_data": {"version": "v1.2", "ip": "..."}},
    {"event_type": "paypal.capture_completed", "created_at": "...", "event_data": {...}},
    {"event_type": "download.completed", "created_at": "...", "event_data": {"ip": "...", "ua": "..."}}
  ],
  "license": { /* si existe */ }
}
```

#### `POST /api/admin/orders/[id]/revoke`
Revoca descargas futuras. No borra logs.
```json
// Response
{"success": true, "message": "Downloads revoked. Existing logs preserved."}
```

#### `GET /api/admin/orders/[id]/evidence-pdf`
Genera y retorna PDF de evidencia.
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="evidence-ORD-A3F8K2.pdf"
```

#### `POST /api/admin/orders/[id]/stages/[stageId]/release` (F)
Libera una etapa de entrega para descarga.
```json
// Response
{"success": true, "stage_type": "full", "status": "ready", "released_at": "2026-02-13T10:00:00Z"}
```

#### `POST /api/admin/orders/[id]/dispute-mode` (J)
Activa modo disputa: congela evidencia, genera PDF final inmutable.
```json
// Request
{"reason": "PayPal dispute opened by buyer"}

// Response
{
  "success": true,
  "frozen_at": "2026-02-20T14:00:00Z",
  "frozen_pdf_key": "frozen/ORD-A3F8K2-evidence.pdf",
  "chain_integrity": "VALID",
  "total_events": 14
}
```
**Flujo server-side (J):**
1. Verificar integridad de la cadena de hashes de order_events.
2. Generar Evidence Pack PDF final con IPs desencriptadas (solo para este PDF).
3. Subir PDF a S3 como `frozen/{order_id}-evidence.pdf`.
4. Actualizar orden: `status=frozen`, `evidence_frozen_at`, `evidence_frozen_by_admin`, `frozen_evidence_pdf_key`.
5. Bloquear descargas futuras (downloads se deniegan con `DENIED_FROZEN`).
6. Registrar events: `admin.dispute_mode_activated`, `admin.evidence_frozen`.
7. El PDF congelado es inmutable — regenerar requiere crear nuevo freeze.

#### `GET /api/admin/orders/[id]/frozen-evidence` (J)
Descarga el PDF de evidencia congelado (si existe).
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="frozen-evidence-ORD-A3F8K2.pdf"
```

#### `GET /api/admin/orders/[id]/verify-chain` (A)
Verifica integridad de la cadena de hashes de eventos.
```json
// Response
{
  "valid": true,
  "total_events": 14,
  "first_event_at": "2026-02-12T14:58:30Z",
  "last_event_at": "2026-02-16T10:00:00Z",
  "broken_at_sequence": null
}
```

#### CRUD Productos
- `POST /api/admin/products` — crear
- `PUT /api/admin/products/[id]` — actualizar
- `DELETE /api/admin/products/[id]` — soft-delete (is_active=false)
- `POST /api/admin/products/[id]/files` — subir archivo (multipart)
- `DELETE /api/admin/products/[id]/files/[fileId]` — eliminar archivo

#### CRUD Términos
- `GET /api/admin/terms` — lista versiones
- `POST /api/admin/terms` — crear nueva versión
- `PUT /api/admin/terms/[id]/activate` — activar versión

---

## E) WEBHOOK PAYPAL — DETALLE TÉCNICO

### Verificación de firma

```
POST https://api-m.paypal.com/v1/notifications/verify-webhook-signature

Body:
{
  "auth_algo": headers['paypal-auth-algo'],
  "cert_url": headers['paypal-cert-url'],
  "transmission_id": headers['paypal-transmission-id'],
  "transmission_sig": headers['paypal-transmission-sig'],
  "transmission_time": headers['paypal-transmission-time'],
  "webhook_id": PAYPAL_WEBHOOK_ID (de tu config),
  "webhook_event": body (el payload completo)
}

Respuesta esperada:
{ "verification_status": "SUCCESS" }
```

### Idempotencia (C — UNIQUE constraint en DB)

1. Extraer `body.id` (webhook event ID de PayPal, ej: `WH-2WR32451HC608454T-5W507613HL206511T`)
2. Intentar INSERT en `webhook_logs` con `paypal_event_id = body.id`
3. Si INSERT falla por UNIQUE violation → duplicado, responder 200, no procesar de nuevo
4. Si INSERT ok → procesar evento, marcar `processed=true`, guardar `linked_order_id`
5. Al crear `OrderEvent` para este webhook, setear `external_ref = body.id` (A+C liga webhook ↔ evento)

**Ventaja vs check-then-insert:** La constraint UNIQUE en DB es atómica y race-condition-free. Dos webhooks simultáneos con el mismo ID: uno inserta, el otro falla limpiamente.

### Orden de confianza

```
NUNCA confiar en el redirect del cliente para confirmar pago.

Fuente de verdad (en orden de prioridad):
1. Webhook PAYMENT.CAPTURE.COMPLETED (máxima confianza)
2. Respuesta del server-side capture (buena confianza)
3. Redirect del buyer al frontend (CERO confianza para habilitar descarga)

Flujo real:
- El capture server-side ya habilita descargas (status=paid)
- El webhook confirma definitivamente (status=confirmed)
- Ambos estados permiten descarga
- status=pending NUNCA permite descarga
```

---

## F) FLUJO DE ENTREGA DIGITAL

### Token firmado (HMAC)

```
Estructura del token:
{
  "order_id": "uuid",
  "file_id": "uuid",
  "exp": 1700000000,  // Unix timestamp (15 min desde creación)
  "nonce": "random_16_bytes"
}

Token = base64url(JSON) + "." + HMAC-SHA256(base64url(JSON), DOWNLOAD_SECRET)
```

### Validación en endpoint de descarga

```
1. Split token por "."
2. Verificar HMAC con DOWNLOAD_SECRET
3. Decodificar payload
4. Verificar exp > NOW()
5. Buscar orden:
   - status IN ('paid', 'confirmed')
   - downloads_revoked == false
   - download_count < download_limit
   - downloads_expire_at > NOW()
6. Si todo OK → stream archivo → incrementar count → log events
7. Si falla → log evento denied con razón específica → 403
```

### Expiración y límites

```
download_limit:     configurable por producto (default: 3)
download_expires:   configurable por producto (default: 7 días desde compra)
token_expiry:       15 minutos (hardcoded, renovable pidiendo nuevo token)
```

---

## G) SNAPSHOT FORENSE DE PRODUCTO (B mejorado)

Al confirmar el pago se generan **3 tipos de snapshot** almacenados en `order_snapshots`:

### 1. Snapshot JSON (siempre)
Se guarda en `orders.product_snapshot` (JSONB) Y en `order_snapshots` con `snapshot_type='json'`.

```json
{
  "snapshot_version": 2,
  "captured_at": "2026-02-12T15:00:00.000Z",
  "product": {
    "id": "uuid",
    "slug": "custom-kitpvp-plugin",
    "name": "Custom KitPvP Plugin",
    "description": "## Features...",
    "category": "source-code",
    "price_usd": "450.00",
    "metadata": {
      "mc_versions": ["1.20", "1.21"],
      "platforms": ["Paper"],
      "tags": ["pvp", "plugin"]
    }
  },
  "files": [
    {
      "id": "uuid",
      "filename": "KitPvP-v2.1.zip",
      "sha256_hash": "abc123...",
      "file_size": 2450000
    }
  ],
  "terms": {
    "version_id": "uuid",
    "version_label": "v1.2",
    "content_hash": "def456..."
  },
  "price_charged": "450.00",
  "currency": "USD"
}
```

### 2. Snapshot HTML (B)
Server-side render de la página `/product/[slug]` con Puppeteer al momento del pago. Se sube a S3 como archivo HTML estático.
- Key: `snapshots/{order_id}/product-page.html`
- Incluye: descripción, precio, compatibilidad, términos visibles — exactamente como lo vio el buyer.
- Hash SHA256 del HTML almacenado en `order_snapshots.snapshot_hash`.

### 3. Snapshot PDF (B)
Puppeteer genera PDF de esa misma página renderizada.
- Key: `snapshots/{order_id}/product-page.pdf`
- Listo para adjuntar directamente a disputas PayPal.
- Hash SHA256 del PDF almacenado.

### Pipeline de generación
```
1. Captura pago confirmada
2. Construir snapshot_json (datos del producto + archivos + términos)
3. Guardar en orders.product_snapshot (JSONB inmutable)
4. Lanzar Puppeteer headless → navegar a /product/[slug]?snapshot=true
   (param snapshot=true desactiva checkout, muestra banner "Snapshot at [timestamp]")
5. Capturar HTML → subir a S3 → calcular hash
6. Generar PDF → subir a S3 → calcular hash
7. Insertar 3 registros en order_snapshots (json, html, pdf)
8. Registrar event: delivery.snapshot_generated
```

**Propósito:** Si cambias el producto después de la venta, la evidencia refleja exactamente qué compró el buyer. El HTML/PDF es prueba visual directa para disputas "not as described". El JSON es para reconstrucción programática.

---

## H) WATERMARK / LICENSING PIPELINE

### Cuándo se ejecuta
Solo para categoría `source-code`. Se ejecuta después del capture exitoso, antes de habilitar descargas.

### Pipeline paso a paso

```
1. DESCARGAR archivo original de S3/R2 → buffer/temp

2. DESCOMPRIMIR ZIP en directorio temporal

3. GENERAR license_key: LIC-XXXX-XXXX-XXXX (aleatorio criptográfico)

4. GENERAR fingerprint: SHA256(order_id + buyer_email + license_key + timestamp)

5. CREAR/MODIFICAR archivos:

   a) LICENSE.txt (raíz del ZIP) — con bloque legal corto (G):
      ──────────────────────────────
      LICENSED TO: buyer@example.com
      ORDER: ORD-A3F8K2
      LICENSE KEY: LIC-A1B2-C3D4-E5F6
      DATE: 2026-02-12T15:00:00Z
      FINGERPRINT: abc123def456...

      LEGAL NOTICE:
      This software is licensed exclusively to the individual or entity
      identified above. Unauthorized copying, redistribution, resale, or
      sharing of this software, in whole or in part, is strictly prohibited
      and constitutes a violation of the license agreement. The licensor
      reserves the right to revoke this license and pursue legal remedies
      in the event of a breach. By using this software, you acknowledge
      and agree to these terms. All rights not expressly granted herein
      are reserved by the licensor.
      ──────────────────────────────

   b) License.java (si existe directorio src/):
      /**
       * AUTO-GENERATED LICENSE - DO NOT REMOVE
       * Licensed to: buyer@example.com
       * Order: ORD-A3F8K2
       * Key: LIC-A1B2-C3D4-E5F6
       * Fingerprint: abc123def456...
       * Generated: 2026-02-12T15:00:00Z
       */
      public final class License {
          public static final String KEY = "LIC-A1B2-C3D4-E5F6";
          public static final String FINGERPRINT = "abc123def456...";
          public static final String ORDER = "ORD-A3F8K2";
      }

   c) INYECTAR comentario de licencia en archivos .java clave:
      - plugin.yml / paper-plugin.yml → añadir campo: license-key
      - Main class (detectar @Plugin o extends JavaPlugin) → insertar
        header comment con fingerprint
      - Mínimo 5 archivos .java si existen → header comment corto:
        // Licensed: LIC-A1B2-C3D4-E5F6 | ORD-A3F8K2

6. RE-COMPRIMIR como nuevo ZIP

7. CALCULAR SHA256 del nuevo ZIP

8. SUBIR a S3/R2 con key: deliveries/{order_id}/{filename}

9. GUARDAR en DB:
   - orders.delivery_package_key
   - orders.delivery_package_hash
   - orders.delivery_package_generated_at
   - licenses: license_key, fingerprint, etc.

10. REGISTRAR eventos:
    - delivery.watermark_applied (data: {files_modified: [...], fingerprint})
    - delivery.package_generated (data: {sha256, storage_key})

11. LIMPIAR directorio temporal
```

### Para categorías NO source-code (maps, configurations)

```
1. Copiar archivo original como delivery package (o wrappear en ZIP con LICENSE.txt)
2. Calcular SHA256
3. Subir a deliveries/{order_id}/
4. No se genera License.java ni watermark en código
5. Se registran mismos eventos
```

---

## I) EVIDENCE PACK PDF — CONTENIDO EXACTO

### Estructura del PDF (páginas)

```
PÁGINA 1: PORTADA + RESUMEN
═══════════════════════════
EVIDENCE PACK — DIGITAL DELIVERY PROOF
Order: ORD-A3F8K2
Generated: 2026-02-12T18:30:00 UTC

Summary:
- Product: Custom KitPvP Plugin
- Amount: $450.00 USD
- Buyer Email: buyer@example.com
- Payment Method: PayPal
- PayPal Transaction: 9XY12345AB678901C
- Order Date: 2026-02-12T15:00:00 UTC
- Delivery Type: DIGITAL — NO PHYSICAL SHIPPING
- Status: Confirmed (webhook verified)

PÁGINA 2: PAYMENT DETAILS
═════════════════════════
PayPal Order ID: 5O190127TN364715T
PayPal Capture ID: 9XY12345AB678901C
Payer Email (PayPal): buyer@example.com
Payer ID: BUYERID123
Amount: $450.00 USD
Currency: USD
PayPal Status: COMPLETED
Capture Timestamp: 2026-02-12T15:00:12 UTC
Webhook Received: 2026-02-12T15:00:18 UTC
Webhook Event ID: WH-2WR32451HC608454T
Webhook Signature: VERIFIED ✓

PÁGINA 3: PRODUCT SNAPSHOT (at time of purchase)
════════════════════════════════════════════════
Product: Custom KitPvP Plugin
Category: Source Code
Description: [primeros 500 chars del snapshot]
Price: $450.00 USD
Compatibility: MC 1.20, 1.21 | Paper
Files Included:
  - KitPvP-v2.1.zip (2.45 MB)
    SHA256 (original): abc123...
    SHA256 (delivered): def456... (watermarked)

PÁGINA 4: TERMS ACCEPTANCE RECORD
═════════════════════════════════
Terms Version: v1.2
Terms Content Hash: sha256_of_terms_content
Accepted At: 2026-02-12T14:58:30 UTC
Accepted From IP: 190.xxx.xxx.xxx
Accepted User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
Acceptance Method: Explicit checkbox ("I accept the Terms and Conditions")

PÁGINA 5: DELIVERY & DOWNLOAD LOG
═════════════════════════════════
Delivery Package Generated: 2026-02-12T15:00:25 UTC
Package SHA256: def456...
Watermark Applied: YES
  - Fingerprint: abc123def456...
  - License Key: LIC-A1B2-C3D4-E5F6
  - Files Modified: License.java, Main.java, plugin.yml, +3 files

Staged Delivery (si aplica):
  Stage 1 (preview): JAR demo | SHA256: aaa111... | Status: delivered | Downloads: 2/3
  Stage 2 (full):    Source   | SHA256: bbb222... | Status: delivered | Downloads: 1/3

Download History (incluye intentos denegados) (E):
┌──────┬─────────────────────────┬─────────────────┬──────────────┬───────────────┐
│  #   │  Timestamp (UTC)        │  IP Address     │  Country     │ Result        │
├──────┼─────────────────────────┼─────────────────┼──────────────┼───────────────┤
│  1   │ 2026-02-12 15:05:00     │ 190.xxx.xxx.xxx │  Argentina   │ OK            │
│  2   │ 2026-02-13 09:12:30     │ 190.xxx.xxx.xxx │  Argentina   │ OK            │
│  3   │ 2026-02-15 22:01:15     │ 190.xxx.xxx.xxx │  Argentina   │ OK            │
│  4   │ 2026-02-16 10:00:00     │ 190.xxx.xxx.xxx │  Argentina   │ DENIED_LIMIT  │
└──────┴─────────────────────────┴─────────────────┴──────────────┴───────────────┘
Total Downloads: 3 / 3 (limit reached)
Denied Attempts: 1
Downloads Expire At: 2026-02-19T15:00:00 UTC

PÁGINA 6: EMAIL DELIVERY LOG + PROOF OF ACCESS (H)
═══════════════════════════════════════════════════
Email Notifications:
  - Order confirmation email sent: 2026-02-12 15:00:30 UTC
    To: buyer@example.com
    Subject: "Order ORD-A3F8K2 — Download Ready"
    SMTP Response: 250 OK (accepted)
    Message-ID: <abc123@mail.tudominio.com>

  - (Si SMTP tracking disponible)
    Delivery confirmed: 2026-02-12 15:00:35 UTC

Proof of Access to "My Downloads" page (H):
  Buyer accessed /downloads/ORD-A3F8K2:
  ┌─────┬─────────────────────────┬─────────────────┬────────────┐
  │  #  │  Timestamp (UTC)        │  IP Address     │  Country    │
  ├─────┼─────────────────────────┼─────────────────┼────────────┤
  │  1  │ 2026-02-12 15:04:00     │ 190.xxx.xxx.xxx │ Argentina  │
  │  2  │ 2026-02-13 09:10:00     │ 190.xxx.xxx.xxx │ Argentina  │
  └─────┴─────────────────────────┴─────────────────┴────────────┘
  (Prueba de que el buyer accedió activamente a su área de descargas)

PÁGINA 7: ADMIN ACTIONS LOG (H)
═══════════════════════════════
(Solo eventos admin relevantes a esta orden)

2026-02-16 11:00:00 UTC │ admin.evidence_exported    │ admin@tudominio.com
2026-02-20 14:00:00 UTC │ admin.dispute_mode_activated│ admin@tudominio.com
2026-02-20 14:00:05 UTC │ admin.evidence_frozen      │ PDF key: frozen/ORD-A3F8K2.pdf

PÁGINA 8: EVENT TIMELINE (con hash chain)
════════════════════════════════════════
[Cronológico, todos los eventos de order_events con hash chain (A)]

#  │ Timestamp (UTC)         │ Event                     │ Detail              │ Hash (first 12)
1  │ 2026-02-12 14:58:30     │ terms.accepted            │ v1.2 │ IP: 190.xxx  │ a3f8c2e91b...
2  │ 2026-02-12 14:58:45     │ order.created             │ ORD-A3F8K2          │ 7d2b4f0e8a...
3  │ 2026-02-12 14:59:00     │ paypal.order_created      │ 5O190127TN364715T   │ e1c9a3d5f7...
4  │ 2026-02-12 15:00:12     │ paypal.capture_completed  │ 9XY12345AB678901C   │ b5e2d8f1a4...
5  │ 2026-02-12 15:00:18     │ paypal.webhook_received   │ WH-2WR32451HC...   │ c8a1f3e6d9...
6  │ 2026-02-12 15:00:18     │ payment.confirmed         │ webhook verified    │ d4b7c2a9e1...
7  │ 2026-02-12 15:00:25     │ delivery.package_generated│ SHA256: def456...   │ f9e3a7b1c5...
8  │ 2026-02-12 15:00:25     │ delivery.watermark_applied│ LIC-A1B2-C3D4-E5F6 │ a2d6e8c4f0...
9  │ 2026-02-12 15:00:30     │ email.sent                │ to: buyer@...       │ b1c5d9e3a7...
10 │ 2026-02-12 15:04:00     │ download.access_page_viewed│ IP: 190.xxx        │ e4f8a2c6d0...
11 │ 2026-02-12 15:05:00     │ download.completed        │ IP: 190.xxx | #1   │ c3d7e1a5f9...
12 │ 2026-02-13 09:12:30     │ download.completed        │ IP: 190.xxx | #2   │ d8a2f6c0e4...
13 │ 2026-02-15 22:01:15     │ download.completed        │ IP: 190.xxx | #3   │ a7b1c5d9e3...
14 │ 2026-02-16 10:00:00     │ download.denied_limit     │ IP: 190.xxx | 3/3  │ f0e4a8c2d6...

Chain integrity: VALID ✔ (all hashes verified sequentially)

PÁGINA 9: LEGAL NOTICE
═════════════════════
This document constitutes digital proof of delivery for a digital product
transaction. All timestamps are in UTC. All IP addresses and user agents
were captured server-side at the time of each event. File integrity is
verified by SHA256 hash comparison. Event chain integrity is verified by
sequential SHA256 hash linking (tamper-evident). This evidence package was
generated automatically by [Tu marca] Evidence System.

IP addresses shown in this document are masked for privacy (I). Full
unmasked IPs are available in encrypted form and can be decrypted by
authorized personnel for dispute resolution purposes only.

Document generated: 2026-02-12T18:30:00 UTC
Document hash: SHA256 of this PDF content
```

---

## J) PANTALLAS UX (RUTAS + COMPONENTES)

### Rutas públicas

| Ruta | Componente | Descripción |
|---|---|---|
| `/` | `HomePage` | Landing con categorías destacadas |
| `/store` | `StorePage` | Redirect a /store/configurations |
| `/store/[category]` | `CategoryPage` | Grid de productos + filtros laterales |
| `/product/[slug]` | `ProductPage` | Detalle: galería, descripción, compatibilidad, checkout |
| `/checkout/[orderId]` | `CheckoutPage` | PayPal Smart Buttons + resumen |
| `/thankyou/[orderId]` | `ThankYouPage` | Confirmación + enlace descargas |
| `/downloads` | `DownloadsPage` | Formulario email+order → mis descargas |
| `/downloads/[orderNumber]` | `OrderDownloadsPage` | Lista archivos + botón descargar |
| `/terms` | `TermsPage` | Términos actuales completos |

### Rutas admin (protegidas)

| Ruta | Componente | Descripción |
|---|---|---|
| `/admin` | `AdminDashboard` | Resumen: ventas recientes, stats |
| `/admin/orders` | `OrdersTable` | Tabla paginada con filtros |
| `/admin/orders/[id]` | `OrderDetail` | Timeline + logs + evidence/revoke + dispute mode (J) |
| `/admin/orders/[id]/dispute` | `DisputePanel` | Panel dispute mode: freeze, verify chain, frozen PDF (J) |
| `/admin/products` | `ProductsTable` | CRUD productos |
| `/admin/products/new` | `ProductForm` | Crear producto |
| `/admin/products/[id]/edit` | `ProductForm` | Editar producto |
| `/admin/terms` | `TermsManager` | Lista versiones + crear nueva |
| `/admin/login` | `LoginPage` | NextAuth credentials |

### Componentes compartidos clave

- `ProductCard` — card para grids de catálogo
- `ImageGallery` — galería de producto con thumbnails
- `PayPalCheckout` — wrapper de Smart Buttons
- `TermsCheckbox` — checkbox con scroll de términos, captura versión
- `EventTimeline` — visualización cronológica de eventos
- `DownloadButton` — solicita token + descarga
- `EvidencePdfButton` — genera y descarga PDF
- `StatusBadge` — badge de estado de orden
- `CategoryNav` — navegación por categorías
- `AdminSidebar` — menú lateral admin
- `DisputePanel` — panel dispute mode con freeze + verify chain + frozen PDF (J)
- `StageDeliveryPanel` — panel de entrega por etapas (F)
- `ChainIntegrityBadge` — indicador de integridad de la cadena de hashes (A)

---

## K) PRIVACIDAD Y PROTECCIÓN DE DATOS (I)

### Enmascaramiento de IPs

**En vistas normales (admin panel, Evidence PDF estándar):**
- IPv4: `190.xxx.xxx.123` → `190.xxx.xxx.xxx` (solo primer octeto visible)
- IPv6: `2001:0db8:85a3::8a2e` → `2001:xxxx:xxxx::xxxx`
- Función: `maskIp(ip: string): string` en `lib/privacy.ts`

**En dispute mode (J):**
- IPs completas se desencriptan para el PDF congelado.
- Solo accesible por admin con acción explícita (dispute-mode activation).

### Encriptación de IPs en DB

```
Algoritmo: AES-256-GCM
Key: IP_ENCRYPTION_KEY (env var, 32 bytes)
IV: random 12 bytes por valor (almacenado como parte del ciphertext)
Formato almacenado: iv(12) + ciphertext + authTag(16)
```

**Dónde se almacena:**
- `orders.buyer_ip_encrypted`
- `orders.terms_accepted_ip_encrypted`
- `order_events.ip_encrypted`

**Campo `ip_address` (texto plano enmascarado):** Se guarda la versión enmascarada para búsquedas rápidas y vistas sin desencriptar. Ej: `190.xxx.xxx.xxx`.

### Política de retención

- **Retención mínima:** 540 días desde `created_at` de la orden.
- **Campo:** `orders.retention_expires_at` = `created_at + 540 days`.
- **Job periódico (cron):** Revisa órdenes donde `retention_expires_at < NOW()` Y `status NOT IN ('disputed', 'frozen')`.
- **Acción al expirar:** Borrar `ip_encrypted`, `buyer_ip`, `terms_accepted_ip` y sus versiones encriptadas. Mantener hashes y eventos (sin IPs).
- **Órdenes en disputa/frozen:** NUNCA se purgan automáticamente.

### Variable de entorno adicional
```
IP_ENCRYPTION_KEY=   # 32 bytes hex o base64
```

---

## L) DISPUTE MODE — CONGELAMIENTO DE EVIDENCIA (J)

### Concepto
Cuando un buyer abre disputa en PayPal, el admin activa "Dispute Mode" en la orden. Esto:
1. **Congela** la evidencia: genera un PDF final inmutable con IPs completas.
2. **Bloquea** descargas futuras (status=frozen).
3. **Verifica** integridad de la cadena de hashes.
4. **Almacena** el PDF en S3 como archivo congelado (no se regenera, es final).

### Flujo completo

```
1. Admin recibe notificación de disputa PayPal
2. Admin navega a /admin/orders/[id]
3. Admin hace clic "Activate Dispute Mode"
4. Sistema pide confirmación (acción irreversible)
5. Server-side:
   a) Verificar cadena de hashes (recalcular todos los event_hash secuencialmente)
   b) Si cadena inválida → alertar admin, marcar evento con WARNING
   c) Desencriptar todas las IPs de events y de la orden
   d) Generar Evidence Pack PDF completo (9 páginas) con IPs reales
   e) Calcular SHA256 del PDF
   f) Subir a S3: frozen/{order_id}-evidence-{timestamp}.pdf
   g) Actualizar orden:
      - status = frozen
      - evidence_frozen_at = NOW()
      - evidence_frozen_by_admin = admin email
      - frozen_evidence_pdf_key = S3 key
   h) Registrar eventos:
      - admin.dispute_mode_activated {reason, admin_email, chain_valid}
      - admin.evidence_frozen {pdf_key, pdf_hash, total_events}
   i) Bloquear descargas: cualquier intento futuro → download.denied_frozen
6. Admin descarga frozen PDF y lo sube a PayPal Resolution Center
```

### Garantías
- El PDF congelado es **inmutable**: una vez generado, no cambia.
- Si se necesita un nuevo freeze (ej: nuevos eventos), se genera un **nuevo** PDF con timestamp diferente.
- La cadena de hashes prueba que ningún evento fue modificado post-facto.
- El `external_ref` en events liga directamente con el `paypal_event_id` del webhook, cerrando el círculo de trazabilidad.

---

## M) CHECKLIST DE SEGURIDAD

### Headers HTTP
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Content-Security-Policy` configurado (restringir scripts a self + paypal)
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Rate Limiting
- [ ] `/api/checkout/*` → 10 req/min por IP
- [ ] `/api/download/*` → 20 req/min por IP
- [ ] `/api/webhook/paypal` → 100 req/min (PayPal puede enviar ráfagas)
- [ ] `/api/admin/*` → 60 req/min por sesión
- [ ] Login admin → 5 intentos / 15 min (brute-force protection)

### Almacenamiento
- [ ] Archivos en S3/R2 con bucket PRIVADO (sin acceso público)
- [ ] URLs pre-firmadas NUNCA expuestas al cliente (stream desde server)
- [ ] Archivos de entrega en path separado: `deliveries/{order_id}/`
- [ ] Archivos originales en: `products/{product_id}/`

### Base de datos
- [ ] `order_events` sin UPDATE/DELETE grants (append-only enforced a nivel DB o aplicación)
- [ ] Backups automáticos diarios (mínimo 540 días retención)
- [ ] Conexión SSL a PostgreSQL
- [ ] Credenciales en variables de entorno, nunca en código

### Autenticación
- [ ] Admin auth via NextAuth con credenciales (hash bcrypt)
- [ ] Session token HTTP-only, Secure, SameSite=Strict
- [ ] CSRF protection en formularios admin
- [ ] No hay registro público de usuarios (admin manually provisioned)

### PayPal
- [ ] Client ID y Secret en env vars
- [ ] Webhook signature verification en CADA request
- [ ] Idempotency check antes de procesar webhook
- [ ] NUNCA confiar en redirect del cliente para confirmar pago
- [ ] Sandbox para desarrollo, Live para producción (env switch)

### Tokens de descarga
- [ ] HMAC-SHA256 con secret dedicado (DOWNLOAD_SECRET)
- [ ] Expiración corta: 15 minutos
- [ ] Token hash guardado en DB (no plaintext)
- [ ] Validación server-side completa antes de servir archivo

### General
- [ ] HTTPS obligatorio en producción
- [ ] Variables de entorno: DATABASE_URL, PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_WEBHOOK_ID, DOWNLOAD_SECRET, NEXTAUTH_SECRET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_ENDPOINT
- [ ] .env NUNCA en repositorio (incluir en .gitignore)
- [ ] Docker con usuario no-root
- [ ] Logs de aplicación sin datos sensibles (no loguear tokens, passwords)

---

## N) PLAN DE IMPLEMENTACIÓN POR FASES

### FASE MVP (2-3 semanas)
**Meta: Primera venta funcional con evidencia completa**

1. Setup proyecto Next.js + Prisma + PostgreSQL + Docker
2. Prisma schema + migraciones
3. Lib: paypal.ts, tokens.ts, hashing.ts, storage.ts, forensic.ts
4. API: checkout (create + capture) + webhook PayPal
5. API: download (request token + serve file)
6. Páginas públicas: catálogo, producto, checkout, thankyou, downloads
7. Admin: login + lista órdenes + detalle con timeline
8. Evidence PDF básico (datos + timeline)
9. Seed de productos de prueba
10. Deploy Docker + configuración PayPal sandbox

### FASE V1 (2 semanas adicionales)
**Meta: Watermarking + admin completo + producción**

11. Watermark pipeline para source-code
12. Sistema de licencias (generación + DB)
13. Admin: CRUD productos con upload de archivos
14. Admin: gestión de términos (versionado)
15. Admin: botón revoke downloads
16. Email transaccional (Resend o Nodemailer + SMTP)
17. Geolocalización de IPs (MaxMind GeoLite2 o similar)
18. Evidence PDF completo (con geo, watermark info)
19. Migrar a PayPal Live
20. Deploy producción

### FASE V2 (mejoras post-lanzamiento)
**Meta: Pulido + métricas + protección avanzada**

21. Dashboard admin: gráficas de ventas, métricas
22. Búsqueda y filtros avanzados en catálogo
23. Sistema de reviews / testimonios
24. Cupones/descuentos
25. Detección de patrones sospechosos (múltiples compras mismo IP, emails temporales)
26. Notificaciones admin (Telegram/Discord webhook) en eventos clave
27. Backup automatizado a segundo storage
28. SEO: meta tags, sitemap, structured data
29. CDN para assets públicos (imágenes)
30. Audit log del admin panel
31. Job de retención de datos (purga IPs expiradas) (I)
32. Integración SMTP tracking para proof-of-delivery de emails (H)
