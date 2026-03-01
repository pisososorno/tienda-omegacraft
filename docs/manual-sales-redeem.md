# Manual Sales & Redeem Link — Flujo completo

## Objetivo

Permitir ventas "manuales" (factura PayPal, acuerdos directos) entregando el producto dentro del flujo de la tienda para generar **toda la evidencia** (ToS acceptance + IP/UA + download proof + event chain + Evidence PDF).

---

## Flujo general

```
ADMIN crea "Manual Sale"
  → Sistema genera URL única (redeem token)
  → Admin copia URL y la envía al comprador (PayPal Invoice / WhatsApp / email)

COMPRADOR abre URL /redeem/[token]
  → Ve producto, precio, compatibilidad
  → Acepta ToS (checkbox + link a /terms)
  → Click "Activar y descargar"

SISTEMA (POST /api/redeem/confirm)
  → Crea Order (status=paid, paymentMethod=manual/paypal_invoice)
  → Crea License + fingerprint
  → Crea DownloadToken
  → Registra event chain completa (order.created → terms.accepted → payment.recorded → license.created → download.token_generated → redeem.completed)
  → Asocia manualSale.orderId = order.id
  → Marca manualSale.status = redeemed

COMPRADOR
  → Ve pantalla de éxito con licencia + botón descargar
  → Descarga usa /api/download/[token] existente
  → Se registra download.completed con IP/UA/SHA256
```

---

## Modelo de datos

### ManualSale (Prisma)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `status` | Enum | draft, sent, paid, redeemed, expired, canceled |
| `buyerEmail` | String | Email real (almacenado) |
| `buyerEmailMasked` | String | Email enmascarado para display |
| `buyerName` | String? | Nombre opcional |
| `productId` | FK | Producto asociado |
| `amount` | Decimal | Monto (default: precio del producto) |
| `currency` | String | Default "USD" |
| `paymentMethod` | String | "paypal_invoice" o "manual" |
| `paymentRef` | String? | ID de factura PayPal u otra referencia |
| `paidAt` | DateTime? | Cuándo se marcó como pagado |
| `requirePaymentFirst` | Boolean | Si requiere "Mark as Paid" antes de permitir redeem |
| `notes` | Text? | Notas internas |
| `redeemTokenHash` | String | SHA256(salt + token) — token crudo NUNCA en DB |
| `redeemExpiresAt` | DateTime | Default: +7 días |
| `maxRedeems` | Int | Default: 1 |
| `redeemCount` | Int | Contador de redeems exitosos |
| `redeemedAt` | DateTime? | Timestamp del primer redeem |
| `orderId` | FK? | Order creada al redimir |
| `createdByAdminId` | FK | Admin que creó la venta |

### Relaciones
- `ManualSale → Product` (many-to-one)
- `ManualSale → Order` (one-to-one, nullable)
- `ManualSale → AdminUser` (many-to-one)

---

## API Endpoints

### Admin (requiere SUPER_ADMIN o STORE_ADMIN)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/manual-sales` | Listar ventas manuales (filtros: status, email) |
| POST | `/api/admin/manual-sales` | Crear venta manual → retorna redeemUrl + templateMessage |
| GET | `/api/admin/manual-sales/[id]` | Detalle de una venta |
| PUT | `/api/admin/manual-sales/[id]` | Acciones: mark_paid, cancel, extend_expiry, update_notes |

### Público (sin auth)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/redeem/[token]` | Validar token y obtener info del producto |
| POST | `/api/redeem/confirm` | Confirmar redeem: crea Order + License + DownloadToken |

---

## Seguridad

### Token de redeem
- **32 bytes random** (64 chars hex)
- Almacenado como **SHA256(salt + token)** — token crudo nunca en DB
- Salt configurable: `REDEEM_TOKEN_SALT` env var (default: "redeem-default-salt")
- **Recomendación**: Configurar `REDEEM_TOKEN_SALT` con un valor secreto en producción

### Validaciones en redeem
- Token hash match
- Status != canceled, expired
- `redeemExpiresAt` no vencido
- `redeemCount < maxRedeems`
- Si `requirePaymentFirst`: status debe ser "paid" (no "sent")

### Headers
- `/redeem/*` → `X-Robots-Tag: noindex, nofollow`
- Mensajes genéricos (no revelar si email existe)

### Auditoría (eventos registrados)
- `manual_sale.created`
- `manual_sale.payment_marked`
- `manual_sale.canceled`
- `manual_sale.expiry_extended`

### Event chain en Order (redeem)
1. `order.created` (source=manual_sale, manualSaleId)
2. `terms.accepted` (termsVersionId, contentHash)
3. `payment.recorded` (method, paymentRef, manualSaleId)
4. `license.created` (licenseKey, fingerprint)
5. `download.token_generated` (tokenHashPrefix, expiresAt)
6. `redeem.completed` (manualSaleId, redeemCount)

---

## Evidence PDF — Integración

El Evidence PDF detecta automáticamente ventas manuales buscando:
- Evento `payment.recorded` en la cadena
- Evento `order.created` con `source=manual_sale`

Cuando detecta manual sale, la Sección 5 cambia de "PAYPAL PAYMENT DETAILS" a:
- **"PAYMENT DETAILS (Manual Sale / Invoice)"**
- Payment Method: PayPal Invoice / Manual
- Payment Reference
- Manual Sale ID
- Redeem completed timestamp + IP/UA
- Nota explicativa del flujo

El resto del Evidence PDF funciona igual (ToS, download proof, IP/UA correlation, chain verification).

---

## Admin UI

### Página: `/admin/manual-sales`

**Lista:**
- Tabla con: comprador, producto, monto, método, estado, expiración, acciones
- Badges de color por estado
- Acciones: Marcar como pagado, Extender expiración, Cancelar, Ver orden vinculada

**Crear:**
- Formulario: email, nombre, producto, monto, método pago, referencia, notas
- Checkbox: "Requiere confirmación de pago antes de permitir redeem"
- Al crear: muestra URL de redeem + mensaje plantilla para copiar

**Navegación:**
- Menú lateral: "Manual Sales" (icono Receipt)
- Visible para SUPER_ADMIN y STORE_ADMIN
- SELLER no tiene acceso

---

## Flujo de estados

```
                ┌─── draft ───┐
                │             │
                ▼             │ (si requirePaymentFirst)
    ┌──── sent ◄──────────────┘
    │        │
    │   mark_paid
    │        │
    │        ▼
    │      paid ────────► redeemed
    │                        │
    │                        ▼
    │                    (Order creada)
    │
    └───► canceled
    
    draft/sent/paid → expired (automático por tiempo)
```

---

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `REDEEM_TOKEN_SALT` | Salt para hash del token de redeem | "redeem-default-salt" |
| `APP_URL` | URL base para construir redeem URLs | "http://localhost:3000" |

---

## Archivos involucrados

| Archivo | Descripción |
|---------|-------------|
| `prisma/schema.prisma` | Modelo `ManualSale` + enum `ManualSaleStatus` |
| `src/app/api/admin/manual-sales/route.ts` | CRUD admin (GET list, POST create) |
| `src/app/api/admin/manual-sales/[id]/route.ts` | Acciones admin (GET detail, PUT actions) |
| `src/app/api/redeem/[token]/route.ts` | Validar token público |
| `src/app/api/redeem/confirm/route.ts` | Confirmar redeem → crear Order |
| `src/app/(public)/redeem/[token]/page.tsx` | Página pública de redeem |
| `src/app/admin/manual-sales/page.tsx` | Admin UI lista + crear |
| `src/app/admin/layout.tsx` | Nav item "Manual Sales" |
| `src/lib/evidence-pdf.tsx` | Sección 5 adaptada para manual sales |
| `next.config.mjs` | noindex para /redeem/*, bodySizeLimit |

---

## Test plan

1. Crear ManualSale con `paypal_invoice` + product + buyer email + invoiceId
2. Copiar Redeem URL
3. Abrir Redeem URL en incógnito
4. Aceptar ToS y activar
5. Descargar archivo
6. Export Evidence PDF y verificar:
   - Payment method invoice/manual + invoiceId visible
   - terms.accepted + download.completed + correlation match
   - Chain valid
7. Segundo intento de redeem (mismo token) debe fallar (maxRedeems=1)
8. Crear ManualSale con `requirePaymentFirst=true` → redeem debe fallar hasta "Mark as Paid"
9. Cancel → redeem debe fallar
10. Extend expiry → nueva fecha visible

---

## Commit sugerido

```
feat: manual sales redeem flow for PayPal invoices (evidence-compatible)
```
