# CHECKLIST DE SEGURIDAD — Tienda Digital Minecraft

## Headers HTTP
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Content-Security-Policy` (restringir scripts a self + paypal.com)
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Rate Limiting
- [ ] `/api/checkout/*` → 10 req/min por IP
- [ ] `/api/download/*` → 20 req/min por IP
- [ ] `/api/webhook/paypal` → 100 req/min
- [ ] `/api/admin/*` → 60 req/min por sesión
- [ ] Login admin → 5 intentos / 15 min (brute-force protection)

## Almacenamiento de Archivos
- [ ] Bucket S3/R2 PRIVADO (sin acceso público)
- [ ] URLs pre-firmadas NUNCA expuestas al cliente
- [ ] Archivos streameados desde server, no redirect a S3
- [ ] Archivos de entrega: `deliveries/{order_id}/`
- [ ] Archivos originales: `products/{product_id}/`
- [ ] Imágenes públicas en bucket separado o CDN

## Base de Datos
- [ ] `order_events` sin permisos UPDATE/DELETE (append-only)
- [ ] Backups automáticos diarios
- [ ] Retención mínima: 540 días
- [ ] Conexión SSL a PostgreSQL
- [ ] Credenciales solo en variables de entorno
- [ ] Prepared statements (Prisma lo hace por defecto)

## Tamper-Evident Event Chain (A)
- [ ] Cada `OrderEvent` incluye `sequence_number` monotónico por orden
- [ ] `event_hash` = SHA256(order_id + seq + type + data + prev_hash + created_at)
- [ ] `prev_hash` referencia al hash del evento anterior (NULL para el primero)
- [ ] Unique constraint en `(order_id, sequence_number)` previene inserción fuera de orden
- [ ] Endpoint `/api/admin/orders/[id]/verify-chain` para validar integridad
- [ ] Verificación de cadena automática al activar dispute mode

## Privacidad de IPs (I)
- [ ] IPs almacenadas encriptadas con AES-256-GCM en campos `*_encrypted`
- [ ] Campo `ip_address` solo almacena versión enmascarada (ej: `190.xxx.xxx.xxx`)
- [ ] `IP_ENCRYPTION_KEY` en env vars (32 bytes)
- [ ] IPs completas solo accesibles al activar dispute mode (J)
- [ ] Política de retención: purga IPs después de 540 días (excepto disputas/frozen)
- [ ] Job cron para purga automática de IPs expiradas

## Dispute Mode (J)
- [ ] Activación requiere confirmación explícita del admin
- [ ] Genera PDF final inmutable con IPs desencriptadas
- [ ] PDF congelado almacenado en S3 (`frozen/{order_id}-evidence.pdf`)
- [ ] Orden pasa a status `frozen` — bloquea descargas futuras
- [ ] Verificación de cadena de hashes antes de congelar
- [ ] Eventos de dispute mode registrados en la cadena

## Autenticación Admin
- [ ] NextAuth con credenciales (bcrypt hash, cost ≥ 12)
- [ ] Session token: HTTP-only, Secure, SameSite=Strict
- [ ] CSRF protection en formularios
- [ ] Sin registro público (admin provisionado manualmente)
- [ ] Session expiry: 24h max

## PayPal
- [ ] Client ID y Secret en env vars
- [ ] Webhook signature verification en CADA request
- [ ] Idempotency: `paypal_event_id` UNIQUE constraint en `webhook_logs` (C)
- [ ] Duplicados rechazados por DB atómicamente (no check-then-insert)
- [ ] `webhook_logs.linked_order_id` liga webhook con orden
- [ ] `order_events.external_ref` liga evento con `paypal_event_id` (A+C)
- [ ] NUNCA confiar en redirect del cliente
- [ ] Sandbox para dev, Live para prod (env switch)
- [ ] Verificar amount/currency coincide con orden interna

## Tokens de Descarga
- [ ] HMAC-SHA256 con DOWNLOAD_SECRET dedicado
- [ ] Expiración: 15 minutos
- [ ] Token hash en DB (no plaintext)
- [ ] Validación completa server-side antes de servir
- [ ] Single-use opcional (configurable)

## Variables de Entorno Requeridas
```
DATABASE_URL=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_MODE=sandbox|live
DOWNLOAD_SECRET=
IP_ENCRYPTION_KEY=          # 32 bytes hex o base64 (I)
NEXTAUTH_SECRET=
NEXTAUTH_URL=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_ENDPOINT=
S3_REGION=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=
APP_URL=
```

## Staged Delivery (F)
- [ ] Productos source-code caros soportan entrega en 2 etapas
- [ ] Stage 1 (preview): auto-release al pagar
- [ ] Stage 2 (full): requiere release manual del admin
- [ ] Cada stage tiene límite de descargas independiente
- [ ] Cada stage tiene su propio SHA256 hash
- [ ] Download tokens incluyen `stage_id` cuando aplica

## General
- [ ] HTTPS obligatorio en producción
- [ ] `.env` en `.gitignore`
- [ ] Docker con usuario no-root
- [ ] No loguear tokens, passwords, secrets
- [ ] No loguear IPs completas en logs de aplicación (solo enmascaradas)
- [ ] Sanitizar inputs (Prisma parameteriza, pero validar en API layer)
- [ ] Validación con Zod en todos los endpoints
- [ ] Error responses sin stack traces en producción
- [ ] Descargas soportan Range requests para resume (E)
- [ ] Intentos de descarga denegados se registran como eventos (E)
