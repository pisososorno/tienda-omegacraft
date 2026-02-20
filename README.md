# TiendaDigital — Tienda de Productos Digitales

Plataforma e-commerce para productos digitales con sistema forense anti-chargeback, cadena de eventos tamper-evident y defensa automatica contra contracargos de PayPal.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL + Prisma ORM
- **Storage:** Cloudflare R2 / AWS S3
- **Payments:** PayPal Orders API v2 + Webhooks
- **Auth:** NextAuth.js (admin credentials)
- **Email:** Nodemailer (SMTP)
- **PDF:** @react-pdf/renderer (evidence pack)

---

## Instalacion rapida (desarrollo local)

### Requisitos previos

- Node.js 20+
- Docker Desktop (para PostgreSQL)

### Paso 1: Clonar y configurar

```bash
git clone <tu-repo>
cd TiendaDigital
cp .env.example .env.local
```

### Paso 2: Generar claves secretas

Ejecuta este comando **3 veces** y pega cada resultado en `.env.local`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Pega los valores en:
- `NEXTAUTH_SECRET` — primera clave generada
- `DOWNLOAD_SECRET` — segunda clave generada
- `IP_ENCRYPTION_KEY` — tercera clave generada

### Paso 3: Base de datos

```bash
docker compose up -d postgres
npm install --legacy-peer-deps
npx prisma migrate deploy
npm run db:seed
```

### Paso 4: Iniciar

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### Paso 5: Acceso admin

- URL: [http://localhost:3000/admin](http://localhost:3000/admin)
- Email: `admin@tiendadigital.com`
- Password: `admin123`

> **Importante:** Cambia la contrasena del admin desde el panel de administracion antes de ir a produccion.

---

## Deploy en produccion

### Opcion A: VPS con Docker (recomendado)

Funciona en cualquier VPS (DigitalOcean, Hetzner, Contabo, etc.) con Docker instalado.

**1. Sube el proyecto al servidor:**
```bash
git clone <tu-repo> /opt/tienda-digital
cd /opt/tienda-digital
cp .env.example .env.local
```

**2. Edita `.env.local` con tus valores reales:**
```env
# Base de datos (cambia la contrasena)
DATABASE_URL="postgresql://postgres:TU_PASSWORD_SEGURO@postgres:5432/tienda_digital?schema=public"

# Seguridad (genera 3 claves diferentes)
NEXTAUTH_SECRET="clave-generada-1"
NEXTAUTH_URL="https://tudominio.com"
DOWNLOAD_SECRET="clave-generada-2"
IP_ENCRYPTION_KEY="clave-generada-3"

# PayPal (de developer.paypal.com → Apps & Credentials → Live)
PAYPAL_CLIENT_ID="tu-client-id-live"
PAYPAL_CLIENT_SECRET="tu-secret-live"
PAYPAL_WEBHOOK_ID="tu-webhook-id"
PAYPAL_MODE="live"

# S3 / Cloudflare R2 (donde se guardan los archivos de productos)
S3_ACCESS_KEY_ID="tu-access-key"
S3_SECRET_ACCESS_KEY="tu-secret-key"
S3_BUCKET="tienda-digital"
S3_ENDPOINT="https://tu-cuenta.r2.cloudflarestorage.com"
S3_REGION="auto"

# Email (SMTP — Resend, Mailgun, Gmail, etc.)
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASS="tu-api-key"
FROM_EMAIL="ventas@tudominio.com"

# App
APP_URL="https://tudominio.com"
APP_NAME="TuTienda"
```

**3. Construir y ejecutar:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**4. Ejecutar migraciones y seed:**
```bash
docker exec tienda-app npx prisma migrate deploy
docker exec tienda-app node -e "require('./prisma/seed')"
```

**5. Configurar Nginx como reverse proxy (HTTPS):**
```nginx
server {
    listen 443 ssl;
    server_name tudominio.com;

    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Opcion B: Node.js directo (sin Docker)

Para hosts que ya tienen PostgreSQL y Node.js disponibles.

```bash
git clone <tu-repo>
cd TiendaDigital
cp .env.example .env.local
# Editar .env.local con tus valores

npm install --legacy-peer-deps
npx prisma migrate deploy
npm run db:seed
npm run build
npm start
```

La app corre en el puerto 3000.

### Opcion C: Railway / Render / Fly.io

Estos servicios detectan Next.js automaticamente:

1. Conecta tu repositorio
2. Agrega un servicio PostgreSQL
3. Copia las variables de `.env.example` a las Environment Variables del servicio
4. El deploy es automatico al hacer push

---

## Configuracion post-deploy

Una vez desplegado, ve a `https://tudominio.com/admin/settings` y configura:

1. **Nombre de la tienda** — aparece en el navbar, emails y documentos legales
2. **Correos** — soporte y privacidad (aparecen en terminos y politica de privacidad)
3. **Textos del hero** — titulo y descripcion de la pagina de inicio
4. **Apariencia** — colores del tema

### Configurar PayPal Webhooks

1. Ve a [developer.paypal.com](https://developer.paypal.com) → My Apps → tu app
2. En la seccion **Webhooks**, agrega una URL: `https://tudominio.com/api/webhooks/paypal`
3. Selecciona estos eventos:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.CAPTURE.REVERSED`
   - `CUSTOMER.DISPUTES.CREATED`
4. Copia el **Webhook ID** y ponlo en `PAYPAL_WEBHOOK_ID` de tu `.env.local`
5. Reinicia la app

### Subir productos

1. Sube los archivos de productos a tu bucket S3/R2
2. Desde el panel admin, crea productos con las storage keys correspondientes

---

## Proteccion anti-chargeback

Cada compra genera automaticamente evidencia forense que incluye:

- **Identidad verificada** — nombre del comprador vs nombre del titular PayPal
- **Geolocalizacion** — pais y ciudad desde la IP del comprador
- **Aceptacion de terminos** — con hash SHA-256 del contenido, IP, user-agent y timestamp
- **Prueba de entrega** — logs de descarga con IP, user-agent y resultado
- **Cadena tamper-evident** — cada evento tiene hash SHA-256 encadenado
- **PDF de evidencia** — documento de 13 secciones listo para enviar a PayPal

Cuando llega una disputa:
1. Ve al panel admin → Ordenes → selecciona la orden
2. Haz clic en **"Activar Modo Disputa"**
3. El sistema congela la evidencia, revoca descargas y genera el PDF
4. Descarga el PDF y subelo al [Resolution Center de PayPal](https://www.paypal.com/disputes/)

---

## Scripts

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm start` | Iniciar en produccion |
| `npm run db:migrate` | Migraciones (desarrollo) |
| `npm run db:migrate:deploy` | Migraciones (produccion) |
| `npm run db:seed` | Cargar datos de ejemplo |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run db:reset` | Resetear DB + re-seed |

## Estructura del proyecto

```
src/
├── app/
│   ├── (public)/          # Paginas publicas (catalogo, checkout, mis-descargas)
│   ├── admin/             # Panel de administracion
│   └── api/
│       ├── auth/          # NextAuth
│       ├── checkout/      # create-order, capture
│       ├── webhooks/      # Webhook handler de PayPal
│       ├── download/      # Descarga segura con soporte Range
│       ├── products/      # Listado y detalle de productos
│       ├── my-downloads/  # Acceso a descargas del comprador
│       └── admin/         # API admin (ordenes, disputas, evidencia)
├── components/
│   ├── layout/            # Navbar
│   └── ui/                # Componentes shadcn/ui
└── lib/
    ├── prisma.ts          # Singleton de Prisma
    ├── forensic.ts        # Cadena de eventos tamper-evident
    ├── evidence-pdf.tsx   # Generador de PDF de evidencia
    ├── paypal.ts          # PayPal API (create/capture/webhook)
    ├── privacy.ts         # Cifrado AES-256-GCM de IPs
    ├── geoip.ts           # Geolocalizacion de IP
    ├── storage.ts         # S3/R2 upload/download
    ├── snapshot.ts        # Snapshots forenses de productos
    ├── watermark.ts       # Watermark en archivos de codigo
    ├── tokens.ts          # Tokens de descarga (HMAC-signed)
    ├── mailer.ts          # Email transaccional
    └── auth.ts            # Configuracion NextAuth
```
