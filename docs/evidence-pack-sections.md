# Evidence Pack PDF — Secciones y Datos

## Resumen

El Evidence Pack es un PDF generado automáticamente para defensa ante chargebacks.
Contiene 17 secciones con evidencia forense tamper-evident para productos digitales descargables.

Generado por: `pdf-lib` (puro JavaScript, sin React, sin WASM, compatible con Docker standalone).

Endpoint: `GET /api/admin/orders/:id/evidence-pdf`

---

## Secciones del PDF

### 1. ORDER SUMMARY
Datos básicos de la orden: número, ID, status, fecha, producto, monto, datos del comprador (nombre, email, IP masked, país, ciudad).

### 2. DIGITAL DELIVERY DETAILS (Sección A)
- **Product Type**: Digital download (intangible)
- **Delivery Method**: Instant download via secure token + license key
- **Delivery Completed**: YES/NO (basado en evento `download.completed`)
- **First Download At**: Timestamp del primer download exitoso
- **Delivery Token Created**: Timestamp del primer `download.token_generated`
- **Delivery Revocable**: YES + estado actual (revoked, license status)

### 3. IDENTITY VERIFICATION
Comparación nombre/email del checkout vs PayPal payer. Badge de MATCH/MISMATCH.

### 4. SESSION CORRELATION (Sección D)
Correlación compra ↔ descarga:
- **Checkout IP vs Download IP**: MATCH / DIFFERENT / UNKNOWN
- **Checkout UA vs Download UA**: MATCH / DIFFERENT / UNKNOWN
- **Checkout Location** (país/ciudad si disponible)
- **Time to First Download**: Minutos entre `payment.captured` y `download.completed`

Responde a disputas "Unauthorized" y "Not received".

### 5. PAYPAL PAYMENT DETAILS — Extract (Sección F)
Extracto humano del pago PayPal (8-12 campos clave):
- Order ID, Capture ID, Status, Amount, Currency
- Payer ID, Payer Email, Payer Name
- Create Time, Update Time (del rawCapture)
- Merchant Email, Merchant ID (del rawCapture.purchase_units)
- Verificación: Webhook received / API verified

### 6. TERMS OF SERVICE ACCEPTANCE
- Versión, hash SHA256, timestamp, IP, User-Agent
- Extracto del contenido (primeros 400 chars)

### 7. REFUND POLICY & DIGITAL ACKNOWLEDGEMENT (Sección H)
- Declaración explícita de política de no reembolso para bienes digitales
- Referencia a ToS version + hash + timestamp de aceptación

### 8. LICENSE INFORMATION
Clave de licencia, fingerprint, status, fecha de creación.

### 9. PRODUCT SNAPSHOT — Human Readable (Sección G)
- Nombre, categoría, slug, descripción corta
- Versión, MC versions, plataformas (del metadata)
- Precio bloqueado al momento de compra
- **Lista de archivos incluidos**: filename, size, SHA256, mimeType
- Referencia al JSON snapshot completo

### 10. DOWNLOAD HISTORY — Detailed (Sección B)
Tabla detallada por cada descarga completada:
| Timestamp | File | Size | SHA256 | IP (masked) | UA | Result | downloadCount |

También muestra intentos de descarga denegados (DENIED_*) con razón.

**Datos registrados por `download.completed`**:
- `filename`, `fileSizeBytes`, `fileSha256`
- `contentLength`, `storageKey`, `stageId`
- `downloadCountAfter`, `rangeRequested`
- IP (masked + encrypted), User-Agent

### 11. DELIVERY STAGES
Para productos source_code: stages (preview/full) con file, size, SHA256, downloads, released date.

### 12. PROOF OF ACCESS — Web Activity (Sección C)
Eventos de actividad web del comprador:
- `checkout.success_viewed` — Vio la página "Payment Successful"
- `downloads.page_viewed` — Abrió "My Downloads"
- `download.button_clicked` — Presionó "Download Now"
- `download.link_opened` — Abrió un link token
- `download.access_page_viewed` — Accedió a la página de descargas (server-side)

Cada evento incluye: timestamp, IP (masked), User-Agent.

### 13. EMAIL DELIVERY LOG (Sección E)
Eventos de envío de email:
- `email.purchase_sent` — Email de compra enviado
- `email.failed` — Fallo en envío

Datos: recipient (masked), provider (smtp), smtpHost, messageId, status, error (si falló).

### 14. ADMIN ACTIONS LOG
Acciones administrativas (freeze, revoke, etc.) con timestamp y datos.

### 15. FORENSIC PRODUCT SNAPSHOTS
Referencias a snapshots JSON/HTML/PDF con hashes.

### 16. TAMPER-EVIDENT EVENT CHAIN
- Badge CHAIN VALID / CHAIN BROKEN
- Total events, first/last event timestamps
- **Cadena completa**: cada evento con seq#, type, time, IP, hash, prevHash

### 17. DISPUTE MODE STATUS
Solo si la orden está congelada: frozen at, frozen by, retention until.

---

## Instrumentación Backend

### Eventos Forenses Nuevos

| Evento | Origen | Datos |
|--------|--------|-------|
| `checkout.success_viewed` | Frontend (checkout return page) | source, orderId |
| `downloads.page_viewed` | Frontend (my-downloads page) | source, orderId |
| `download.button_clicked` | Frontend (my-downloads page) | source, stageId |
| `download.link_opened` | Frontend (tracking API) | source |
| `email.purchase_sent` | Mailer (interno) | messageId, to (masked), provider, smtpHost, status |
| `email.failed` | Mailer (interno) | emailType, to (masked), provider, error, status |

### Datos Enriquecidos en `download.completed`

| Campo | Descripción |
|-------|-------------|
| `filename` | Nombre del archivo descargado |
| `fileSizeBytes` | Tamaño en bytes del archivo |
| `fileSha256` | Hash SHA256 del archivo servido |
| `contentLength` | Bytes enviados en la respuesta |
| `storageKey` | Clave de almacenamiento |
| `stageId` | ID del stage (si staged delivery) |
| `downloadCountAfter` | Conteo de descargas después de esta |
| `rangeRequested` | Header Range (si resume/partial) |
| `tokenHashPrefix` | Primeros 8 chars del hash del token |

### API de Tracking

`POST /api/track`

```json
{
  "orderId": "uuid",
  "email": "buyer@email.com",
  "eventType": "checkout.success_viewed",
  "extra": {}
}
```

Solo acepta event types whitelisted. Valida que orderId pertenece al email.

---

## Archivos Modificados

- `src/lib/evidence-pdf.tsx` — PDF completo con 17 secciones (pdf-lib)
- `src/app/api/admin/orders/[id]/evidence-pdf/route.ts` — Include product files
- `src/app/api/track/route.ts` — **NUEVO** — Tracking endpoint público
- `src/app/api/download/[token]/route.ts` — Enriquecido download.completed
- `src/lib/mailer.ts` — Email logging interno (purchase_sent + failed)
- `src/app/api/checkout/capture/route.ts` — Pasa orderId al mailer
- `src/app/(public)/checkout/page.tsx` — Guarda email en sessionStorage
- `src/app/(public)/checkout/return/page.tsx` — Track checkout.success_viewed
- `src/app/(public)/my-downloads/page.tsx` — Track page_viewed + button_clicked
- `next.config.mjs` — Removido @react-pdf/renderer de externals
- `Dockerfile` — Externals solo archiver (no más @react-pdf)
