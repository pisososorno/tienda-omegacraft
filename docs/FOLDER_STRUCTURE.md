# ESTRUCTURA DE CARPETAS — Tienda Digital Minecraft

```
TiendaDigital/
├── .env.example                    # Variables de entorno (template)
├── .env.local                      # Variables locales (gitignored)
├── .gitignore
├── docker-compose.yml              # PostgreSQL + App
├── Dockerfile
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
│
├── prisma/
│   ├── schema.prisma               # Modelo de datos completo
│   ├── migrations/                  # Migraciones auto-generadas
│   └── seed.ts                     # Seed: admin user + productos demo + términos
│
├── public/
│   ├── favicon.ico
│   └── images/                     # Assets estáticos públicos (logo, etc.)
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout (fonts, metadata, providers)
│   │   ├── page.tsx                # Landing / Home
│   │   ├── globals.css             # Tailwind base
│   │   │
│   │   ├── store/
│   │   │   ├── page.tsx            # Redirect a /store/configurations
│   │   │   └── [category]/
│   │   │       └── page.tsx        # Grid de productos por categoría
│   │   │
│   │   ├── product/
│   │   │   └── [slug]/
│   │   │       └── page.tsx        # Detalle de producto + checkout
│   │   │
│   │   ├── checkout/
│   │   │   └── [orderId]/
│   │   │       └── page.tsx        # PayPal Smart Buttons
│   │   │
│   │   ├── thankyou/
│   │   │   └── [orderId]/
│   │   │       └── page.tsx        # Confirmación post-pago
│   │   │
│   │   ├── downloads/
│   │   │   ├── page.tsx            # Formulario: email + order number
│   │   │   └── [orderNumber]/
│   │   │       └── page.tsx        # Lista de archivos + botón descargar
│   │   │
│   │   ├── terms/
│   │   │   └── page.tsx            # Términos y condiciones actuales
│   │   │
│   │   ├── admin/
│   │   │   ├── layout.tsx          # Admin layout (sidebar + auth guard)
│   │   │   ├── page.tsx            # Dashboard (stats rápidos)
│   │   │   ├── login/
│   │   │   │   └── page.tsx        # Login admin
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx        # Tabla de órdenes + filtros
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Detalle orden + timeline + evidence
│   │   │   ├── products/
│   │   │   │   ├── page.tsx        # Tabla de productos
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx    # Formulario crear producto
│   │   │   │   └── [id]/
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx # Formulario editar producto
│   │   │   └── terms/
│   │   │       └── page.tsx        # Gestión de versiones de términos
│   │   │
│   │   └── api/
│   │       ├── products/
│   │       │   ├── route.ts        # GET: lista productos
│   │       │   └── [slug]/
│   │       │       └── route.ts    # GET: detalle producto
│   │       │
│   │       ├── terms/
│   │       │   └── active/
│   │       │       └── route.ts    # GET: términos activos
│   │       │
│   │       ├── checkout/
│   │       │   ├── create-order/
│   │       │   │   └── route.ts    # POST: crear orden + PayPal order
│   │       │   └── capture-order/
│   │       │       └── route.ts    # POST: capturar pago
│   │       │
│   │       ├── download/
│   │       │   ├── request/
│   │       │   │   └── route.ts    # POST: generar token de descarga
│   │       │   └── file/
│   │       │       └── route.ts    # GET: servir archivo (stream)
│   │       │
│   │       ├── webhook/
│   │       │   └── paypal/
│   │       │       └── route.ts    # POST: webhook PayPal
│   │       │
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts    # NextAuth handler
│   │       │
│   │       └── admin/
│   │           ├── orders/
│   │           │   ├── route.ts    # GET: lista órdenes
│   │           │   └── [id]/
│   │           │       ├── route.ts           # GET: detalle orden
│   │           │       ├── revoke/
│   │           │       │   └── route.ts       # POST: revocar descargas
│   │           │       └── evidence-pdf/
│   │           │           └── route.ts       # GET: generar PDF
│   │           ├── products/
│   │           │   ├── route.ts               # POST: crear producto
│   │           │   └── [id]/
│   │           │       ├── route.ts           # PUT, DELETE: editar/borrar
│   │           │       ├── files/
│   │           │       │   ├── route.ts       # POST: subir archivo
│   │           │       │   └── [fileId]/
│   │           │       │       └── route.ts   # DELETE: eliminar archivo
│   │           │       └── images/
│   │           │           ├── route.ts       # POST: subir imagen
│   │           │           └── [imageId]/
│   │           │               └── route.ts   # DELETE: eliminar imagen
│   │           ├── terms/
│   │           │   ├── route.ts               # GET, POST: listar/crear
│   │           │   └── [id]/
│   │           │       └── activate/
│   │           │           └── route.ts       # PUT: activar versión
│   │           └── stats/
│   │               └── route.ts               # GET: dashboard stats
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components (button, card, etc.)
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── AdminSidebar.tsx
│   │   │   └── CategoryNav.tsx
│   │   ├── store/
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductGrid.tsx
│   │   │   ├── ImageGallery.tsx
│   │   │   ├── CategoryFilter.tsx
│   │   │   └── PriceDisplay.tsx
│   │   ├── checkout/
│   │   │   ├── PayPalCheckout.tsx
│   │   │   ├── TermsCheckbox.tsx
│   │   │   └── OrderSummary.tsx
│   │   ├── download/
│   │   │   ├── DownloadButton.tsx
│   │   │   ├── DownloadStatus.tsx
│   │   │   └── AccessForm.tsx
│   │   └── admin/
│   │       ├── OrdersTable.tsx
│   │       ├── OrderDetail.tsx
│   │       ├── EventTimeline.tsx
│   │       ├── EvidencePdfButton.tsx
│   │       ├── ProductForm.tsx
│   │       ├── FileUploader.tsx
│   │       ├── TermsEditor.tsx
│   │       └── StatusBadge.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts               # Prisma client singleton
│   │   ├── paypal.ts               # PayPal API: create order, capture, verify webhook
│   │   ├── tokens.ts               # HMAC sign/verify para download tokens
│   │   ├── hashing.ts              # SHA256 de archivos y strings
│   │   ├── storage.ts              # S3/R2: upload, download, stream, delete
│   │   ├── watermark.ts            # Pipeline: unzip → inject license → rezip → hash
│   │   ├── evidence.ts             # Generación de Evidence Pack PDF
│   │   ├── forensic.ts             # Event logger: logEvent(orderId, type, data, req)
│   │   ├── mailer.ts               # Envío de emails transaccionales
│   │   ├── geoip.ts                # Geolocalización de IP (MaxMind GeoLite2)
│   │   ├── order-number.ts         # Generador de order numbers (ORD-XXXXXX)
│   │   ├── license-key.ts          # Generador de license keys (LIC-XXXX-XXXX-XXXX)
│   │   ├── auth.ts                 # NextAuth config
│   │   ├── rate-limit.ts           # Rate limiter middleware
│   │   ├── request-info.ts         # Extractor de IP, UA, geo desde request
│   │   └── validations.ts          # Schemas Zod para validar payloads
│   │
│   ├── types/
│   │   ├── index.ts                # Tipos TypeScript compartidos
│   │   ├── paypal.ts               # Tipos para respuestas PayPal
│   │   └── evidence.ts             # Tipos para el PDF de evidencia
│   │
│   └── middleware.ts               # Next.js middleware: security headers, rate limiting
│
├── docs/
│   ├── DESIGN.md                   # Diseño técnico completo (este documento)
│   ├── ENDPOINTS.md                # Referencia de API
│   ├── SECURITY_CHECKLIST.md       # Checklist de seguridad
│   └── FOLDER_STRUCTURE.md         # Este archivo
│
└── scripts/
    ├── create-admin.ts             # Script para crear usuario admin
    └── generate-env.ts             # Script para generar .env con secrets aleatorios
```
