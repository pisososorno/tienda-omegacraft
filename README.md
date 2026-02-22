# TiendaDigital — Tienda de Productos Digitales

Plataforma e-commerce para productos digitales con sistema forense anti-chargeback, cadena de eventos tamper-evident y defensa automatizada contra contracargos de PayPal.

## Tech Stack

- **Framework:** Next.js 16 (App Router, standalone output)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL 16 + Prisma ORM
- **Storage:** Cloudflare R2 / AWS S3
- **Payments:** PayPal Orders API v2 + Webhooks
- **Auth:** NextAuth.js (admin credentials, JWT)
- **Email:** Nodemailer 7 (SMTP)
- **PDF:** @react-pdf/renderer (evidence pack)
- **Container:** Docker multi-stage (node:20-slim)

---

## Desarrollo local

### Requisitos

- Node.js 20+
- Docker Desktop (para PostgreSQL)

### Paso 1: Clonar y configurar

```bash
git clone git@github.com:pisososorno/tienda-omegacraft.git
cd tienda-omegacraft
cp .env.example .env.local
```

### Paso 2: Generar claves secretas

Ejecuta **3 veces** y pega cada resultado en `.env.local`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- `NEXTAUTH_SECRET` — clave 1
- `DOWNLOAD_SECRET` — clave 2
- `IP_ENCRYPTION_KEY` — clave 3

### Paso 3: Base de datos

```bash
docker compose up -d postgres
npm install
npx prisma migrate deploy
npm run db:seed
```

### Paso 4: Iniciar

```bash
npm run dev
```

- App: http://localhost:3000
- Admin: http://localhost:3000/admin (`admin@tiendadigital.com` / `admin123`)

> **Cambia la contraseña del admin antes de ir a producción.**

---

## Deploy en produccion — Servidor dedicado Ubuntu

### Arquitectura del deploy

```
Internet → Cloudflare (SSL) → tu-servidor:80 → NGINX → 127.0.0.1:3000 (Docker)
                                                             ↓
                                                     tienda-app (Next.js)
                                                             ↓
                                                     tienda-postgres (PostgreSQL)
                                                     (red interna Docker)
```

- **NGINX** escucha en 80/443 como reverse proxy (ya existente en el servidor)
- **La app** se bindea a `127.0.0.1:3000` (NO expuesta a internet directamente)
- **PostgreSQL** solo accesible dentro de la red Docker interna (`tienda-net`)
- **Cloudflare** maneja SSL y DNS (proxy naranja activo)
- **No interfiere** con Pterodactyl/Docker existente (red y contenedores con nombres únicos)

### Paso 1: Preparar el servidor

```bash
# Conectar por SSH al servidor
ssh root@tu-servidor

# Crear directorio del proyecto
mkdir -p /opt/tienda/app
cd /opt/tienda/app

# Clonar repo (o subir por scp/rsync)
git clone git@github.com:pisososorno/tienda-omegacraft.git .
```

### Paso 2: Crear `.env.local`

```bash
cp .env.example .env.local
nano .env.local
```

Contenido completo (reemplaza cada valor):

```env
# ── Database ──────────────────────────────────────────
# IMPORTANTE: el host es "postgres" (nombre del servicio Docker, NO localhost)
DATABASE_URL="postgresql://tienda:TU_PASSWORD_DB_SEGURO@postgres:5432/tienda_digital?schema=public"

# Variables para Docker Compose (deben coincidir con DATABASE_URL)
DB_USER=tienda
DB_PASSWORD=TU_PASSWORD_DB_SEGURO
DB_NAME=tienda_digital

# ── NextAuth ──────────────────────────────────────────
NEXTAUTH_SECRET="genera-con-node-crypto-randomBytes-32-hex"
NEXTAUTH_URL="https://tienda.omegacraft.cl"

# ── PayPal ────────────────────────────────────────────
PAYPAL_CLIENT_ID="tu-client-id-LIVE"
PAYPAL_CLIENT_SECRET="tu-secret-LIVE"
PAYPAL_WEBHOOK_ID="tu-webhook-id"
PAYPAL_MODE="live"

# ── Download Tokens ───────────────────────────────────
DOWNLOAD_SECRET="genera-con-node-crypto-randomBytes-32-hex"

# ── IP Encryption (AES-256-GCM) ──────────────────────
IP_ENCRYPTION_KEY="genera-con-node-crypto-randomBytes-32-hex"

# ── S3 / Cloudflare R2 ───────────────────────────────
S3_ACCESS_KEY_ID="tu-access-key-r2"
S3_SECRET_ACCESS_KEY="tu-secret-key-r2"
S3_BUCKET="tienda-digital"
S3_ENDPOINT="https://tu-account-id.r2.cloudflarestorage.com"
S3_REGION="auto"

# ── SMTP (email) ──────────────────────────────────────
SMTP_HOST="smtp.tuproveedor.com"
SMTP_PORT="587"
SMTP_USER="tu-usuario-smtp"
SMTP_PASS="tu-password-smtp"
FROM_EMAIL="ventas@omegacraft.cl"

# ── App ───────────────────────────────────────────────
APP_URL="https://tienda.omegacraft.cl"
APP_NAME="OmegaCraft Store"
```

Para generar las 3 claves secretas:

```bash
# Ejecutar 3 veces, pegar en NEXTAUTH_SECRET, DOWNLOAD_SECRET, IP_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Paso 3: Build y levantar contenedores

```bash
cd /opt/tienda/app

# Construir imagen y levantar todo
docker compose -f docker-compose.prod.yml up -d --build
```

Esto levanta:
- `tienda-postgres` — PostgreSQL 16, datos en volumen `tienda-pgdata`
- `tienda-app` — Next.js en `127.0.0.1:3000`, uploads en volumen `tienda-uploads`

Verificar que están corriendo:

```bash
docker compose -f docker-compose.prod.yml ps
```

### Paso 4: Migrar base de datos y seed inicial

```bash
# Aplicar migraciones de Prisma
docker exec tienda-app npx prisma migrate deploy

# Cargar datos iniciales (admin user + settings + productos ejemplo)
docker exec tienda-app npx tsx prisma/seed.ts
```

### Paso 5: Configurar NGINX

```bash
# Copiar el archivo de config incluido en el repo
sudo cp /opt/tienda/app/nginx/tienda.omegacraft.cl.conf /etc/nginx/sites-available/tienda.omegacraft.cl

# Habilitar el sitio
sudo ln -s /etc/nginx/sites-available/tienda.omegacraft.cl /etc/nginx/sites-enabled/

# Verificar sintaxis
sudo nginx -t

# Recargar NGINX
sudo systemctl reload nginx
```

### Paso 6: Verificar

```bash
# Desde el servidor, probar que responde
curl -s http://127.0.0.1:3000/api/health
# Debe responder: {"status":"ok","db":"connected"}

# Probar a través de NGINX
curl -s -H "Host: tienda.omegacraft.cl" http://127.0.0.1/api/health
# Debe responder: {"status":"ok","db":"connected"}
```

Luego abre https://tienda.omegacraft.cl en el navegador.

### Paso 7: SSL (Cloudflare)

Tienes 2 opciones:

**Opción A — Cloudflare SSL modo "Full" (más simple):**
- En Cloudflare Dashboard → SSL/TLS → modo **Full**
- NGINX escucha solo en :80 (ya configurado)
- Cloudflare encripta visitante↔CF, CF se conecta al servidor por HTTP
- **Ya funciona con la config actual**

**Opción B — Cloudflare SSL modo "Full (Strict)" (más seguro):**
- En Cloudflare Dashboard → Origin Server → Create Certificate
- Descargar `.pem` y `.key` al servidor
- Descomentar el bloque HTTPS en el archivo NGINX
- Requiere que NGINX escuche en :443 con esos certificados

---

## Comandos útiles en producción

```bash
cd /opt/tienda/app

# Ver logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f app

# Ver logs de la DB
docker compose -f docker-compose.prod.yml logs -f postgres

# Reiniciar la app (después de cambiar .env.local)
docker compose -f docker-compose.prod.yml restart app

# Rebuild completo (después de git pull con cambios de código)
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker exec tienda-app npx prisma migrate deploy

# Estado de salud
docker exec tienda-app wget -qO- http://localhost:3000/api/health

# Abrir shell dentro del contenedor
docker exec -it tienda-app sh

# Backup de la base de datos
docker exec tienda-postgres pg_dump -U tienda tienda_digital > backup_$(date +%Y%m%d).sql

# Restaurar backup
cat backup_20260222.sql | docker exec -i tienda-postgres psql -U tienda tienda_digital
```

---

## Configuración post-deploy

### Panel admin

Ve a https://tienda.omegacraft.cl/admin y configura:

1. **Nombre de la tienda** — navbar, emails y documentos legales
2. **Correos** — soporte y privacidad
3. **Textos del hero** — título y descripción del homepage
4. **Apariencia** — colores del tema

### PayPal Webhooks

1. [developer.paypal.com](https://developer.paypal.com) → My Apps → tu app Live
2. Webhooks → Add Webhook → URL: `https://tienda.omegacraft.cl/api/webhooks/paypal`
3. Eventos:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.CAPTURE.REVERSED`
   - `CUSTOMER.DISPUTES.CREATED`
4. Copia el **Webhook ID** → pégalo en `PAYPAL_WEBHOOK_ID` de `.env.local`
5. `docker compose -f docker-compose.prod.yml restart app`

---

## Protección anti-chargeback

Cada compra genera evidencia forense automática:

- **Identidad verificada** — nombre del comprador vs nombre del titular PayPal
- **Geolocalización** — país y ciudad desde la IP del comprador
- **Aceptación de términos** — hash SHA-256 del contenido, IP, user-agent y timestamp
- **Prueba de entrega** — logs de descarga con IP, user-agent y resultado
- **Cadena tamper-evident** — cada evento tiene hash SHA-256 encadenado
- **PDF de evidencia** — documento de 13 secciones listo para PayPal

Cuando llega una disputa:

1. Admin → Órdenes → seleccionar la orden
2. Clic en **"Activar Modo Disputa"**
3. El sistema congela evidencia, revoca descargas, genera PDF
4. Descargar PDF → subir al [Resolution Center de PayPal](https://www.paypal.com/disputes/)

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (incluye prisma generate) |
| `npm start` | Iniciar en producción |
| `npm run db:migrate` | Migraciones (desarrollo) |
| `npm run db:migrate:deploy` | Migraciones (producción) |
| `npm run db:seed` | Cargar datos de ejemplo |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run db:reset` | Resetear DB + re-seed |

## Estructura del proyecto

```
src/
├── app/
│   ├── (public)/          # Páginas públicas (catálogo, checkout, mis-descargas)
│   ├── admin/             # Panel de administración
│   └── api/
│       ├── auth/          # NextAuth
│       ├── checkout/      # create-order, capture
│       ├── health/        # Healthcheck endpoint
│       ├── webhooks/      # Webhook handler de PayPal
│       ├── download/      # Descarga segura con watermarking
│       ├── products/      # Listado y detalle de productos
│       ├── my-downloads/  # Acceso a descargas del comprador
│       └── admin/         # API admin (órdenes, disputas, evidencia)
├── components/
│   ├── layout/            # Navbar
│   └── ui/                # Componentes shadcn/ui
└── lib/
    ├── prisma.ts          # Singleton de Prisma
    ├── forensic.ts        # Cadena de eventos tamper-evident
    ├── evidence-pdf.tsx   # Generador de PDF de evidencia
    ├── paypal.ts          # PayPal API (create/capture/webhook)
    ├── privacy.ts         # Cifrado AES-256-GCM de IPs
    ├── geoip.ts           # Geolocalización de IP
    ├── storage.ts         # S3/R2 upload/download
    ├── snapshot.ts        # Snapshots forenses de productos
    ├── watermark.ts       # Watermark en archivos de código
    ├── tokens.ts          # Tokens de descarga (HMAC-signed)
    ├── mailer.ts          # Email transaccional
    └── auth.ts            # Configuración NextAuth
```
