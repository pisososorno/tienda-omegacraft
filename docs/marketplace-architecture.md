# Arquitectura: Marketplace Interno OmegaCraft

> **Estado**: Propuesta — NO implementar hasta aprobación.  
> **Fecha**: 2026-02-25  
> **Compatibilidad**: Next.js standalone + Prisma + Postgres + Docker (sin cambios a deploy/update scripts)

---

## 1. Diagnóstico del Sistema Actual

### Lo que ya existe y funciona
| Componente | Estado |
|---|---|
| `AdminUser` con email/password + JWT (NextAuth) | ✅ Sin roles — todos son iguales |
| `Product` sin owner/seller FK | ✅ Cualquier admin edita cualquier producto |
| `Order` → 1 producto por orden (no carrito) | ✅ Funcional |
| PayPal capture + webhook (1 cuenta global) | ✅ Funcional |
| `OrderEvent` append-only con hash chain | ✅ Forense |
| `AdminAuditLog` | ✅ Solo acciones de user management |
| 20 rutas API admin — auth = `if (!session) return 401` | ⚠️ Sin RBAC |
| Sidebar admin — estático, mismo para todos | ⚠️ Sin condicionales por rol |
| `OrderStatus`: pending/paid/confirmed/refunded/disputed/revoked/frozen | ✅ Ya soporta disputas |

### Lo que NO existe
- Roles / permisos
- Propiedad de productos (owner)
- Perfil de vendedor
- Wallet / ledger
- Payouts
- Scoping de queries por owner
- Auditoría extendida (solo cubre user mgmt)

---

## 2. Modelo de Datos Propuesto

### 2.1 Cambios a modelos existentes

#### `AdminUser` — agregar campo `role`

```prisma
enum UserRole {
  SUPER_ADMIN    // Tú: acceso total
  STORE_ADMIN    // Equipo confianza: productos/órdenes globales, NO settings críticos
  SELLER         // Vendedor: solo SUS productos/órdenes/wallet
}

model AdminUser {
  // ... campos existentes sin cambio ...
  role           UserRole  @default(SELLER)
  
  // Nuevas relaciones
  sellerProfile  SellerProfile?
  
  // Relaciones existentes sin cambio
  auditLogsAsActor  AdminAuditLog[] @relation("AuditActor")
  auditLogsAsTarget AdminAuditLog[] @relation("AuditTarget")
}
```

> **Migración**: `ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'SELLER';`  
> Luego un data migration para setear el admin existente (tú) como `SUPER_ADMIN`.

#### `Product` — agregar `sellerId`

```prisma
model Product {
  // ... campos existentes sin cambio ...
  sellerId  String?  @map("seller_id")
  
  seller    SellerProfile? @relation(fields: [sellerId], references: [id])
  // ... relaciones existentes sin cambio ...
}
```

> **Migración**: `ALTER TABLE products ADD COLUMN seller_id UUID REFERENCES seller_profiles(id);`  
> Productos existentes quedan con `seller_id = NULL` → visibles solo para SUPER_ADMIN/STORE_ADMIN.  
> Productos nuevos de sellers REQUIEREN `seller_id`.

### 2.2 Nuevos modelos

#### `SellerProfile`

```prisma
enum SellerStatus {
  pending     // Recién creado, esperando aprobación
  active      // Puede vender
  suspended   // Temporalmente suspendido (no puede crear/editar, wallet congelado)
  disabled    // Deshabilitado permanente
}

model SellerProfile {
  id               String        @id @default(uuid())
  userId           String        @unique @map("user_id")
  displayName      String        @map("display_name") @db.VarChar(200)
  payoutEmail      String?       @map("payout_email") @db.VarChar(500) // PayPal email para payouts
  payoutMethod     String        @default("paypal") @map("payout_method") @db.VarChar(50)
  status           SellerStatus  @default(pending)
  
  // Permisos por categoría (flags booleanos — simple y explícito)
  canSellPlugins       Boolean @default(false) @map("can_sell_plugins")
  canSellMaps          Boolean @default(false) @map("can_sell_maps")
  canSellConfigurations Boolean @default(false) @map("can_sell_configurations")
  canSellSourceCode    Boolean @default(false) @map("can_sell_source_code")
  
  // Configuración financiera por seller
  commissionRate   Decimal    @default(0.00) @map("commission_rate") @db.Decimal(5, 4) // 0.0000–1.0000 (ej: 0.15 = 15%)
  holdDays         Int        @default(14) @map("hold_days") // días antes de que pending → available
  reserveRate      Decimal    @default(0.00) @map("reserve_rate") @db.Decimal(5, 4) // % retenido como reserva
  
  createdAt        DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime   @updatedAt @map("updated_at") @db.Timestamptz
  
  user       AdminUser          @relation(fields: [userId], references: [id])
  products   Product[]
  ledger     WalletTransaction[]
  payouts    PayoutRequest[]
  
  @@map("seller_profiles")
}
```

> **Decisión**: Usamos flags booleanos (`canSellPlugins`, etc.) en vez de un array o tabla de join.  
> **Razón**: Solo hay 4 categorías fijas en el enum `ProductCategory`. Si en el futuro las categorías son dinámicas, migramos a una tabla `seller_allowed_categories`.

#### `WalletTransaction` (Ledger)

```prisma
enum WalletTxType {
  sale_credit      // Venta: se acredita al seller
  commission_debit // Comisión OmegaCraft deducida
  reserve_hold     // Reserva de riesgo retenida
  reserve_release  // Reserva liberada después de hold period
  payout_debit     // Retiro aprobado: se descuenta del available
  refund_debit     // Refund/chargeback: se descuenta
  clawback_debit   // Clawback si ya se pagó
  adjustment       // Ajuste manual por admin
}

enum WalletTxStatus {
  pending    // En hold period (sale_credit)
  available  // Disponible para retiro
  completed  // Payout ejecutado / tx finalizada
  reversed   // Revertida por refund/dispute
  cancelled  // Cancelada por admin
}

model WalletTransaction {
  id            String          @id @default(uuid())
  sellerId      String          @map("seller_id")
  orderId       String?         @map("order_id")     // NULL para adjustments
  type          WalletTxType
  status        WalletTxStatus  @default(pending)
  
  amount        Decimal         @db.Decimal(10, 2)    // Siempre positivo
  currency      String          @default("USD") @db.VarChar(3)
  
  // Para doble-entrada conceptual
  balanceBefore Decimal         @map("balance_before") @db.Decimal(10, 2) // Saldo available antes de tx
  balanceAfter  Decimal         @map("balance_after") @db.Decimal(10, 2)  // Saldo available después
  
  description   String?         @db.VarChar(500)
  metadata      Json            @default("{}")
  
  // Hold management
  availableAt   DateTime?       @map("available_at") @db.Timestamptz // Cuándo pasa de pending → available
  processedAt   DateTime?       @map("processed_at") @db.Timestamptz
  processedBy   String?         @map("processed_by")  // Admin que procesó (para payouts/adjustments)
  
  createdAt     DateTime        @default(now()) @map("created_at") @db.Timestamptz
  
  seller SellerProfile @relation(fields: [sellerId], references: [id])
  
  @@index([sellerId])
  @@index([orderId])
  @@index([status])
  @@index([availableAt])
  @@index([createdAt])
  @@map("wallet_transactions")
}
```

#### `PayoutRequest`

```prisma
enum PayoutStatus {
  requested   // Seller solicitó retiro
  approved    // Admin aprobó
  processing  // En proceso de envío
  paid        // Pagado exitosamente
  rejected    // Admin rechazó
  cancelled   // Seller canceló
  failed      // Falló el envío
}

model PayoutRequest {
  id            String        @id @default(uuid())
  sellerId      String        @map("seller_id")
  amount        Decimal       @db.Decimal(10, 2)
  currency      String        @default("USD") @db.VarChar(3)
  status        PayoutStatus  @default(requested)
  
  payoutEmail   String        @map("payout_email") @db.VarChar(500) // Snapshot del email al momento de solicitar
  payoutMethod  String        @default("paypal") @map("payout_method") @db.VarChar(50)
  
  // Admin actions
  reviewedBy    String?       @map("reviewed_by") // AdminUser.id
  reviewedAt    DateTime?     @map("reviewed_at") @db.Timestamptz
  reviewNote    String?       @map("review_note") @db.Text
  
  // Payment tracking
  externalRef   String?       @map("external_ref") @db.VarChar(500) // PayPal payout batch ID / reference
  paidAt        DateTime?     @map("paid_at") @db.Timestamptz
  
  createdAt     DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime      @updatedAt @map("updated_at") @db.Timestamptz
  
  seller SellerProfile @relation(fields: [sellerId], references: [id])
  
  @@index([sellerId])
  @@index([status])
  @@index([createdAt])
  @@map("payout_requests")
}
```

### 2.3 Ampliar `AdminAuditLog`

El modelo actual ya es flexible con `action` (varchar) y `metadata` (json). Solo necesitamos:
- Ampliar los valores de `action` usados (no requiere cambio de schema)
- Documentar las nuevas acciones

```
Nuevas acciones a registrar:
  seller_profile_created
  seller_profile_updated
  seller_status_changed     // {from, to, reason}
  seller_categories_changed // {before, after}
  role_changed              // {userId, from, to}
  product_created           // {productId, sellerId}
  product_updated           // {productId, fields_changed}
  product_deleted           // {productId, sellerId}
  payout_requested          // {payoutId, amount}
  payout_approved           // {payoutId, by}
  payout_rejected           // {payoutId, by, reason}
  payout_paid               // {payoutId, externalRef}
  wallet_adjustment         // {sellerId, amount, reason}
  wallet_hold_released      // {txId}
  wallet_clawback           // {txId, orderId, reason}
```

### 2.4 Diagrama de Relaciones

```
AdminUser (1) ──── (0..1) SellerProfile
                              │
                    ┌─────────┼──────────┐
                    │         │          │
               Product[]  WalletTx[]  PayoutRequest[]
                    │
               Order[] ──── WalletTx (via orderId)
```

---

## 3. Matriz de Permisos (RBAC)

### 3.1 Recursos y Acciones

| Recurso | Acción | SUPER_ADMIN | STORE_ADMIN | SELLER |
|---|---|---|---|---|
| **Dashboard** | Ver global | ✅ | ✅ | ❌ |
| **Dashboard** | Ver propio | ✅ | ✅ | ✅ (solo sus stats) |
| **Products** | Listar todos | ✅ | ✅ | ❌ |
| **Products** | Listar propios | ✅ | ✅ | ✅ |
| **Products** | Crear | ✅ | ✅ | ✅ (solo categorías autorizadas) |
| **Products** | Editar cualquiera | ✅ | ✅ | ❌ |
| **Products** | Editar propios | ✅ | ✅ | ✅ |
| **Products** | Eliminar | ✅ | ✅ | ✅ (solo propios, si no hay órdenes) |
| **Orders** | Listar todas | ✅ | ✅ | ❌ |
| **Orders** | Listar propias | ✅ | ✅ | ✅ |
| **Orders** | Ver detalle | ✅ | ✅ | ✅ (solo de sus productos) |
| **Orders** | Dispute/Freeze/Revoke | ✅ | ✅ | ❌ |
| **Admin Users** | CRUD | ✅ | ❌ | ❌ |
| **Seller Profiles** | Ver todos | ✅ | ✅ (read-only) | ❌ |
| **Seller Profiles** | Crear/Editar/Status | ✅ | ❌ | ❌ |
| **Seller Profiles** | Editar propio (payout email) | ✅ | ❌ | ✅ |
| **Wallet Ledger** | Ver global | ✅ | ✅ (read-only) | ❌ |
| **Wallet Ledger** | Ver propio | ✅ | ❌ | ✅ |
| **Wallet** | Adjustment manual | ✅ | ❌ | ❌ |
| **Payouts** | Solicitar | ❌ | ❌ | ✅ |
| **Payouts** | Aprobar/Rechazar/Marcar pagado | ✅ | ❌ | ❌ |
| **Payouts** | Ver todos | ✅ | ✅ (read-only) | ❌ |
| **Payouts** | Ver propios | ❌ | ❌ | ✅ |
| **Settings** | Todo | ✅ | ❌ | ❌ |
| **Terms & Privacy** | Editar | ✅ | ❌ | ❌ |

### 3.2 Implementación del RBAC

**Estrategia**: Middleware helper + guard por ruta.

```typescript
// src/lib/rbac.ts

type Role = "SUPER_ADMIN" | "STORE_ADMIN" | "SELLER";

interface AuthContext {
  userId: string;
  role: Role;
  sellerId: string | null; // de SellerProfile
}

// Helper: obtener contexto auth completo
async function getAuthContext(session): Promise<AuthContext | null>

// Guard: verificar rol mínimo
function requireRole(ctx: AuthContext, ...allowed: Role[]): boolean

// Guard: verificar ownership de producto
async function requireProductOwner(ctx: AuthContext, productId: string): boolean

// Guard: verificar que seller puede usar categoría
async function requireCategoryPermission(ctx: AuthContext, category: ProductCategory): boolean

// Scoping: construir WHERE clause según rol
function scopeProductsWhere(ctx: AuthContext): Prisma.ProductWhereInput
function scopeOrdersWhere(ctx: AuthContext): Prisma.OrderWhereInput
```

**En cada ruta API**:

```typescript
// Antes (actual):
const session = await getServerSession(authOptions);
if (!session) return jsonError("Unauthorized", 401);

// Después:
const ctx = await getAuthContext();
if (!ctx) return jsonError("Unauthorized", 401);
if (!requireRole(ctx, "SUPER_ADMIN", "STORE_ADMIN")) {
  return jsonError("Forbidden", 403);
}
```

### 3.3 Propagación del Rol al JWT

Modificar `src/lib/auth.ts`:
- En `authorize()`: leer `admin.role` y `admin.sellerProfile?.id`
- En callback `jwt()`: persistir `role` y `sellerId` en el token
- En callback `session()`: exponer `role` y `sellerId` en `session.user`

Esto permite al frontend (sidebar, UI) renderizar condicionalmente SIN hacer fetch adicional.

---

## 4. Flujo de Pagos: Venta → Ledger → Hold → Available → Payout

### 4.1 Flujo Completo

```
COMPRADOR paga → PayPal captura → checkout/capture/route.ts
    │
    ▼
[1] Order.status = "paid"
    │
    ▼
[2] CREAR WalletTransaction (sale_credit)
    ├─ amount = Order.amountUsd * (1 - seller.commissionRate)
    ├─ status = "pending"
    ├─ availableAt = now() + seller.holdDays
    └─ metadata = {grossAmount, commission, commissionRate}

[3] CREAR WalletTransaction (commission_debit) — registro contable
    ├─ amount = Order.amountUsd * seller.commissionRate
    ├─ status = "completed"
    └─ description = "Comisión OmegaCraft 15%"

[4] Si seller.reserveRate > 0:
    CREAR WalletTransaction (reserve_hold)
    ├─ amount = netAmount * seller.reserveRate
    ├─ status = "pending"
    └─ availableAt = now() + (seller.holdDays * 2)
```

### 4.2 Transición pending → available (Cron/scheduled)

```
Cada hora (o al consultar wallet):
  SELECT * FROM wallet_transactions
  WHERE status = 'pending'
    AND available_at <= NOW()
    AND type IN ('sale_credit', 'reserve_hold')

  Para cada tx:
    UPDATE status = 'available'
    Recalcular balances
```

> **Implementación MVP**: No necesitamos un cron real. Calculamos el saldo "available" dinámicamente con una query:
> ```sql
> SELECT 
>   SUM(CASE WHEN type IN ('sale_credit','reserve_release','adjustment') 
>            AND status = 'available' THEN amount ELSE 0 END)
>   - SUM(CASE WHEN type IN ('payout_debit','refund_debit','clawback_debit') 
>              AND status = 'completed' THEN amount ELSE 0 END)
> AS available_balance
> FROM wallet_transactions WHERE seller_id = ?
> ```

### 4.3 Solicitud de Payout

```
SELLER solicita retiro:
    │
    ▼
[1] Validar: available_balance >= amount_solicitado
[2] Validar: seller.status = 'active'
[3] Validar: seller.payoutEmail configurado
[4] CREAR PayoutRequest (status = requested)
[5] CREAR WalletTransaction (payout_debit, status = pending)
    └─ Reserva el monto para que no se pueda gastar doble
    │
    ▼
SUPER_ADMIN revisa:
  ├─ APROBAR → PayoutRequest.status = 'approved'
  │            Admin transfiere manualmente por PayPal
  │            Marca como 'paid' → WalletTx.status = 'completed'
  │
  └─ RECHAZAR → PayoutRequest.status = 'rejected'
               WalletTx (payout_debit) → status = 'cancelled'
               Monto vuelve a available
```

### 4.4 Refund / Dispute / Chargeback

```
Webhook: PAYMENT.CAPTURE.REFUNDED o CUSTOMER.DISPUTE.CREATED
    │
    ▼
[1] Order.status = "refunded" o "disputed" (ya existe este handler)
    │
    ▼
[2] NUEVO: Buscar WalletTransaction(sale_credit) de esa orden
    │
    ├─ Si status = 'pending' (aún en hold):
    │    → Cambiar a 'reversed' (dinero nunca estuvo available)
    │
    ├─ Si status = 'available' (ya disponible, no retirado):
    │    → Crear WalletTransaction(refund_debit, status = completed)
    │
    └─ Si ya se pagó al seller (payout completed):
         → Crear WalletTransaction(clawback_debit, status = completed)
         → Seller queda con balance negativo
         → Flag en SellerProfile para revisión manual
```

### 4.5 Cálculo de Saldos (Funciones helper)

```typescript
interface SellerBalance {
  pending: number;    // En hold, no disponible aún
  available: number;  // Disponible para retiro
  reserved: number;   // Pendiente de payout (solicitado pero no pagado)
  totalPaid: number;  // Total histórico pagado
  totalEarned: number;// Total histórico ganado (bruto)
}

async function getSellerBalance(sellerId: string): Promise<SellerBalance>
```

---

## 5. Cambios en API Routes

### 5.1 Rutas existentes a modificar

| Ruta | Cambio |
|---|---|
| `GET /api/admin/products` | Agregar scoping: SELLER solo ve sus productos |
| `POST /api/admin/products` | Asignar `sellerId` si es SELLER; validar categoría permitida |
| `GET /api/admin/products/[id]` | Verificar ownership para SELLER |
| `PUT /api/admin/products/[id]` | Verificar ownership para SELLER |
| `POST /api/admin/products/[id]/files` | Verificar ownership para SELLER |
| `DELETE /api/admin/products/[id]/files` | Verificar ownership para SELLER |
| `POST /api/admin/products/[id]/images` | Verificar ownership para SELLER |
| `GET /api/admin/orders` | Agregar scoping: SELLER solo ve órdenes de sus productos |
| `GET /api/admin/orders/[id]` | Verificar ownership para SELLER |
| `POST /api/admin/orders/[id]/dispute-mode` | Bloquear para SELLER |
| `POST /api/admin/orders/[id]/revoke` | Bloquear para SELLER |
| `GET /api/admin/dashboard` | Scoping: SELLER ve solo sus stats |
| `GET /api/admin/users` | Bloquear para SELLER y STORE_ADMIN |
| `POST /api/admin/users` | Bloquear para SELLER y STORE_ADMIN |
| `PUT /api/admin/settings` | Bloquear para SELLER y STORE_ADMIN |
| `PUT /api/admin/terms` | Bloquear para SELLER y STORE_ADMIN |

### 5.2 Nuevas rutas a crear

| Ruta | Método | Rol mínimo | Descripción |
|---|---|---|---|
| `/api/admin/sellers` | GET | SUPER_ADMIN | Listar todos los sellers |
| `/api/admin/sellers/[id]` | GET/PUT | SUPER_ADMIN | Ver/editar seller profile |
| `/api/admin/sellers/[id]/status` | POST | SUPER_ADMIN | Cambiar status (activate/suspend/disable) |
| `/api/admin/sellers/[id]/categories` | PUT | SUPER_ADMIN | Cambiar categorías permitidas |
| `/api/admin/seller/profile` | GET/PUT | SELLER | Ver/editar MI perfil (payout email, display name) |
| `/api/admin/seller/wallet` | GET | SELLER | Mi balance + historial de transacciones |
| `/api/admin/seller/payouts` | GET/POST | SELLER | Mis payouts / solicitar nuevo retiro |
| `/api/admin/payouts` | GET | SUPER_ADMIN | Listar todos los payout requests |
| `/api/admin/payouts/[id]` | GET | SUPER_ADMIN | Detalle de payout |
| `/api/admin/payouts/[id]/approve` | POST | SUPER_ADMIN | Aprobar payout |
| `/api/admin/payouts/[id]/reject` | POST | SUPER_ADMIN | Rechazar payout |
| `/api/admin/payouts/[id]/mark-paid` | POST | SUPER_ADMIN | Marcar como pagado |
| `/api/admin/wallet/ledger` | GET | SUPER_ADMIN | Ledger global |
| `/api/admin/wallet/adjust` | POST | SUPER_ADMIN | Ajuste manual |

### 5.3 Modificar checkout/capture

En `src/app/api/checkout/capture/route.ts` — después del paso 6 (transacción):

```typescript
// NUEVO PASO: Crear wallet transactions si el producto tiene seller
if (order.product.sellerId) {
  await createSaleWalletEntries(order, order.product.sellerId);
}
```

### 5.4 Modificar webhook handler

En `handleCaptureRefunded` y `handleDisputeCreated`:

```typescript
// NUEVO: Revertir/congelar wallet del seller
if (order.product.sellerId) {
  await handleWalletReversal(order.id, order.product.sellerId);
}
```

---

## 6. Cambios en UI

### 6.1 Sidebar Condicional

```
SUPER_ADMIN ve:           STORE_ADMIN ve:        SELLER ve:
─────────────────        ─────────────────      ─────────────────
Dashboard                Dashboard              Mi Dashboard
Products (todos)         Products (todos)       Mis Productos
Orders (todas)           Orders (todas)         Mis Órdenes
Admin Users              Sellers (read-only)    Mi Wallet
Sellers                  Payouts (read-only)    Mis Payouts
Payouts                  Terms (read-only)      Mi Perfil
Wallet Ledger            My Account             My Account
Terms & Privacy
Settings
My Account
```

### 6.2 Nuevas páginas admin

| Ruta | Descripción |
|---|---|
| `/admin/sellers` | Lista de sellers con status, balance, acciones |
| `/admin/sellers/[id]` | Detalle/edición de seller (categorías, comisión, hold, status) |
| `/admin/payouts` | Lista de solicitudes de payout con acciones aprobar/rechazar/pagar |
| `/admin/wallet` | Ledger global con filtros |
| `/admin/seller/profile` | Perfil del seller (payout email, display name) |
| `/admin/seller/wallet` | Mi balance + historial |
| `/admin/seller/payouts` | Mis solicitudes de retiro |

### 6.3 Modificaciones a páginas existentes

- **Product create/edit**: Si SELLER → select de categoría limitado a las permitidas; `sellerId` auto-asignado
- **Products list**: Si SELLER → filtrado automático
- **Orders list**: Si SELLER → filtrado automático
- **Dashboard**: Si SELLER → stats propias (mis ventas, mi balance, mis productos)
- **Admin Users** (en `/admin/users/[id]`): Agregar selector de rol + botón "Crear Seller Profile"

---

## 7. Riesgos y Mitigaciones

### 7.1 Riesgos Técnicos

| # | Riesgo | Impacto | Probabilidad | Mitigación |
|---|---|---|---|---|
| R1 | Migración rompe datos existentes | Alto | Baja | Campos nuevos nullable o con defaults; productos existentes con `sellerId = NULL` son "de la tienda" |
| R2 | RBAC bypass — seller accede a ruta sin guard | Alto | Media | Crear middleware centralizado `withAuth(roles)` que se aplica a TODAS las rutas admin; test automático que verifica que toda ruta admin tiene guard |
| R3 | Race condition en wallet (doble payout) | Alto | Baja | Usar `$transaction` con `SELECT FOR UPDATE` o advisory locks de Postgres al crear payout |
| R4 | Balance negativo por clawback post-payout | Medio | Baja | Flag en seller profile; bloquear nuevos payouts si balance < 0; notificación al admin |
| R5 | Seller manipula precio/producto post-venta | Medio | Baja | Ya existe `productSnapshot` en Order — inmutable. Wallet usa `Order.amountUsd`, no el precio actual del producto |
| R6 | JWT stale — role cambia pero JWT no se refresca | Medio | Media | JWT maxAge = 8h ya está configurado. Para cambios de rol inmediatos: agregar check en middleware que re-valida role contra DB cada N minutos, o invalidar sesiones activas al cambiar role |
| R7 | Performance — queries wallet con muchas transacciones | Bajo | Baja | Índices ya propuestos; para >10K tx/seller: agregar campo materializado `balanceSnapshot` en SellerProfile actualizado en cada tx |

### 7.2 Riesgos de Negocio

| # | Riesgo | Mitigación |
|---|---|---|
| B1 | Seller sube contenido robado/pirata | Proceso de revisión: productos nuevos en estado `draft` hasta aprobación admin |
| B2 | Seller infla precio para lavado | Límite de precio configurable por seller; alertas si precio > umbral |
| B3 | Dispute rate alto de un seller | Dashboard muestra dispute rate por seller; auto-suspend si > 5% |
| B4 | Seller reclama payout no recibido | Registro de `externalRef` (PayPal batch ID); captura de pantalla como evidencia |

---

## 8. Plan por Fases

### Fase 1: MVP Core (1-2 semanas)

**Objetivo**: RBAC funcional + ownership de productos. Sin wallet aún.

1. Migración: agregar `role` a AdminUser, crear SellerProfile, agregar `sellerId` a Product
2. Crear `src/lib/rbac.ts` con helpers de auth context y guards
3. Modificar `src/lib/auth.ts` para propagar role al JWT
4. Aplicar guards RBAC a las 20 rutas API admin existentes
5. Modificar sidebar para renderizado condicional por rol
6. Crear API + UI para gestión de sellers (CRUD, categorías, status)
7. Modificar product create/edit para asignar sellerId y filtrar categorías
8. Scoping de products list y orders list por seller
9. Setear tu usuario como SUPER_ADMIN via seed/migration
10. Tests manuales de cada combinación rol × acción

**Entregable**: Un SELLER puede loguearse, crear productos en sus categorías, ver solo sus productos/órdenes. No puede tocar settings/users/terms.

### Fase 2: Wallet + Payouts (1-2 semanas)

**Objetivo**: Sistema financiero interno funcional.

1. Migración: crear WalletTransaction y PayoutRequest
2. Crear wallet service (`src/lib/wallet.ts`) con funciones de crédito, débito, balance
3. Hook en `checkout/capture` para crear entradas de wallet post-venta
4. Hook en webhook handler para reversiones por refund/dispute
5. API + UI para seller: ver balance, historial, solicitar payout
6. API + UI para admin: ver ledger global, aprobar/rechazar payouts, marcar pagados
7. API para ajustes manuales de wallet
8. Cron job o cálculo dinámico de pending → available
9. Dashboard seller con estadísticas de ventas y balance

**Entregable**: Flujo completo de venta → acreditación → hold → disponible → payout request → admin aprueba → marca pagado.

### Fase 3: Hardening + UX (1 semana)

**Objetivo**: Robustez y experiencia de usuario.

1. Auditoría: ampliar audit log a todas las acciones nuevas
2. Notificaciones: email al seller cuando payout es aprobado/pagado/rechazado
3. Rate limiting por seller (max productos, max payouts/mes)
4. Dashboard admin: dispute rate por seller, revenue breakdown por seller
5. Auto-suspend seller si dispute rate > umbral
6. Exportar ledger a CSV
7. Tests E2E del flujo completo

### Fase Futura (v2+)

- **Stripe Connect / PayPal Partner**: Split payments automáticos (elimina payouts manuales)
- **Multi-tenant**: Isolación por tienda si se convierte en SaaS
- **Seller public profile**: Página pública del seller en la tienda
- **Reviews / ratings**: Compradores califican productos
- **Seller analytics**: Dashboard avanzado con gráficos de ventas

---

## 9. Impacto en Deploy/Docker

| Aspecto | Impacto |
|---|---|
| `scripts/deploy.sh` | ❌ Sin cambios |
| `scripts/update.sh` | ❌ Sin cambios |
| `docker-compose.prod.yml` | ❌ Sin cambios |
| `Dockerfile` | ❌ Sin cambios |
| `docker/entrypoint.sh` | ❌ Sin cambios (ya ejecuta `prisma migrate deploy` automáticamente) |
| Migraciones Prisma | ✅ Se generan con `prisma migrate dev` local y se aplican automáticamente en deploy |
| Variables de entorno | ❌ Sin nuevas requeridas |

---

## 10. Resumen de Archivos a Crear/Modificar

### Nuevos
- `prisma/migrations/XXXXXX_marketplace_rbac/` — migración automática
- `src/lib/rbac.ts` — helpers RBAC, guards, scoping
- `src/lib/wallet.ts` — servicio de wallet/ledger
- `src/app/api/admin/sellers/route.ts` — CRUD sellers
- `src/app/api/admin/sellers/[id]/route.ts`
- `src/app/api/admin/sellers/[id]/status/route.ts`
- `src/app/api/admin/sellers/[id]/categories/route.ts`
- `src/app/api/admin/seller/profile/route.ts`
- `src/app/api/admin/seller/wallet/route.ts`
- `src/app/api/admin/seller/payouts/route.ts`
- `src/app/api/admin/payouts/route.ts`
- `src/app/api/admin/payouts/[id]/route.ts`
- `src/app/api/admin/payouts/[id]/approve/route.ts`
- `src/app/api/admin/payouts/[id]/reject/route.ts`
- `src/app/api/admin/payouts/[id]/mark-paid/route.ts`
- `src/app/api/admin/wallet/ledger/route.ts`
- `src/app/api/admin/wallet/adjust/route.ts`
- `src/app/admin/sellers/page.tsx`
- `src/app/admin/sellers/[id]/page.tsx`
- `src/app/admin/payouts/page.tsx`
- `src/app/admin/wallet/page.tsx`
- `src/app/admin/seller/profile/page.tsx`
- `src/app/admin/seller/wallet/page.tsx`
- `src/app/admin/seller/payouts/page.tsx`

### Modificados
- `prisma/schema.prisma` — nuevos enums + modelos + campos
- `src/lib/auth.ts` — propagar role/sellerId al JWT
- `src/lib/api-helpers.ts` — posible helper `getAuthContext`
- `src/app/admin/layout.tsx` — sidebar condicional por rol
- `src/app/api/admin/products/route.ts` — scoping + sellerId
- `src/app/api/admin/products/[id]/route.ts` — ownership guard
- `src/app/api/admin/products/[id]/files/route.ts` — ownership guard
- `src/app/api/admin/products/[id]/images/route.ts` — ownership guard
- `src/app/api/admin/orders/route.ts` — scoping
- `src/app/api/admin/orders/[id]/route.ts` — ownership guard
- `src/app/api/admin/orders/[id]/dispute-mode/route.ts` — role guard
- `src/app/api/admin/orders/[id]/revoke/route.ts` — role guard
- `src/app/api/admin/dashboard/route.ts` — scoping
- `src/app/api/admin/users/route.ts` — role guard
- `src/app/api/admin/settings/route.ts` — role guard
- `src/app/api/admin/terms/route.ts` — role guard
- `src/app/api/checkout/capture/route.ts` — wallet hook
- `src/app/api/webhooks/paypal/route.ts` — wallet reversal hook
- `src/app/admin/products/[id]/edit/page.tsx` — categoría filtrada
- `src/app/admin/users/page.tsx` — mostrar role + acciones
