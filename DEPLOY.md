# DEPLOY.md — TiendaDigital Enterprise Deployment Guide

## Arquitectura

```
Internet → Cloudflare (SSL/WAF) → Servidor Ubuntu :80 → NGINX → 127.0.0.1:3000
                                                                      │
                                                               ┌──────┴──────┐
                                                               │  tienda-app │ (Next.js standalone)
                                                               │  node:20.18 │
                                                               └──────┬──────┘
                                                                      │ tienda-net (Docker bridge)
                                                               ┌──────┴──────┐
                                                               │tienda-postgres│ (PostgreSQL 16)
                                                               │  solo red    │
                                                               │  interna     │
                                                               └─────────────┘
```

- **App** bindeada a `127.0.0.1:3000` — no accesible desde internet
- **PostgreSQL** sin puerto expuesto al host — solo red Docker interna
- **NGINX** del host como reverse proxy (no containerizado)
- **Cloudflare** maneja SSL, DNS, WAF
- **Red `tienda-net`** aislada — no interfiere con Pterodactyl/Wings

---

## Requisitos del servidor

- Ubuntu 22.04 o 24.04
- Docker Engine + Docker Compose plugin
- NGINX instalado (`apt install nginx`)
- Git
- Acceso SSH root o sudo

---

## 1) DNS (Cloudflare)

1. Dashboard Cloudflare → dominio → DNS
2. Crear registro **A**:
   - Nombre: `tienda` (o `@` si es dominio raíz)
   - IP: la IP pública de tu servidor
   - Proxy: **activado** (nube naranja)
3. SSL/TLS → modo **Full** (recomendado) o **Full (Strict)** si configuras Origin Certificate

---

## 2) Deploy inicial (1 comando)

```bash
ssh root@tu-servidor

# Clonar repo
git clone git@github.com:tu-usuario/tienda-omegacraft.git /opt/tienda/app
cd /opt/tienda/app

# Deploy completo
bash scripts/deploy.sh
```

El script `deploy.sh` hace todo automáticamente:
1. Valida que Docker y Docker Compose estén instalados
2. Crea `.env.production` desde el template si no existe
3. Genera secrets automáticamente (NEXTAUTH_SECRET, DOWNLOAD_SECRET, IP_ENCRYPTION_KEY, DB_PASSWORD)
4. Te pide revisar/editar `.env.production` antes de continuar
5. Construye la imagen Docker y levanta los contenedores
6. Espera que PostgreSQL y la app estén saludables
7. El entrypoint del contenedor ejecuta automáticamente:
   - `prisma migrate deploy` (migraciones)
   - Seed condicional (crea admin solo si no existe ninguno)
8. Muestra URLs y comandos útiles

### Después del deploy: instalar NGINX

```bash
sudo bash scripts/install-nginx.sh tienda.omegacraft.cl
```

---

## 3) Actualización (update)

```bash
cd /opt/tienda/app
bash scripts/update.sh
```

El script:
1. `git pull` (fast-forward only)
2. Rebuild de la imagen Docker
3. Recrear contenedor (el entrypoint aplica migraciones automáticamente)
4. Espera health check
5. Limpia imágenes Docker antiguas

---

## 4) Rollback básico

```bash
cd /opt/tienda/app

# Ver commits disponibles
git log --oneline -10

# Volver a un commit específico
git checkout <commit-hash>

# Rebuild
docker compose -f docker-compose.prod.yml up -d --build

# Si necesitas revertir una migración (CUIDADO: puede perder datos)
# Solo hazlo si sabes exactamente qué migración revertir
```

---

## 5) Backup y Restore de la base de datos

### Backup

```bash
# Backup completo
docker exec tienda-postgres pg_dump -U tienda tienda_digital > /opt/tienda/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Backup comprimido
docker exec tienda-postgres pg_dump -U tienda tienda_digital | gzip > /opt/tienda/backups/backup_$(date +%Y%m%d).sql.gz
```

### Backup automático (cron)

```bash
# Crear directorio de backups
mkdir -p /opt/tienda/backups

# Agregar cron job (backup diario a las 3 AM, retener 7 días)
crontab -e
```

Agregar esta línea:
```
0 3 * * * docker exec tienda-postgres pg_dump -U tienda tienda_digital | gzip > /opt/tienda/backups/backup_$(date +\%Y\%m\%d).sql.gz && find /opt/tienda/backups -name "*.sql.gz" -mtime +7 -delete
```

### Restore

```bash
# Desde backup SQL plano
cat backup.sql | docker exec -i tienda-postgres psql -U tienda tienda_digital

# Desde backup comprimido
gunzip -c backup.sql.gz | docker exec -i tienda-postgres psql -U tienda tienda_digital
```

---

## 6) Troubleshooting

### Ver logs

```bash
cd /opt/tienda/app

# Logs de la app (Next.js)
docker compose -f docker-compose.prod.yml logs -f app

# Logs de PostgreSQL
docker compose -f docker-compose.prod.yml logs -f postgres

# Últimas 100 líneas
docker compose -f docker-compose.prod.yml logs --tail=100 app
```

### Health check

```bash
# Desde el servidor
curl -s http://127.0.0.1:3000/api/health
# Respuesta esperada: {"status":"ok","db":"connected"}

# A través de NGINX
curl -s -H "Host: tienda.omegacraft.cl" http://127.0.0.1/api/health
```

### Estado de contenedores

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml top
```

### Problemas comunes

| Problema | Solución |
|----------|----------|
| App no arranca | `docker compose -f docker-compose.prod.yml logs app` — buscar error de migración o variable faltante |
| DB no conecta | Verificar `DATABASE_URL` en `.env.production` — host debe ser `postgres` (no localhost) |
| 502 Bad Gateway | La app no está corriendo o no responde en :3000 — verificar logs |
| Uploads no funcionan | Verificar volumen: `docker volume inspect tienda-uploads` |
| Permisos de uploads | El entrypoint hace `chown/chmod` automáticamente en cada inicio |
| Admin bloqueado | `docker exec tienda-app npx tsx scripts/reset-admin.ts` |
| Disco lleno (logs) | Los logs tienen rotación automática (20MB × 5 archivos para app) |

### Reset de admin de emergencia

```bash
# Opción 1: usando el script (usa ADMIN_EMAIL/ADMIN_PASSWORD de .env.production)
docker exec tienda-app npx tsx scripts/reset-admin.ts

# Opción 2: con valores custom
docker exec -e ADMIN_EMAIL=nuevo@email.com -e ADMIN_PASSWORD=NuevaPass123 tienda-app npx tsx scripts/reset-admin.ts
```

---

## 7) Variables de entorno

Archivo: `.env.production` (en el servidor, NUNCA en el repo)

| Variable | Obligatoria | Descripción |
|----------|:-----------:|-------------|
| `DATABASE_URL` | ✅ | URL de PostgreSQL (host=`postgres` en Docker) |
| `DB_USER` | ✅ | Usuario PostgreSQL (usado por docker-compose) |
| `DB_PASSWORD` | ✅ | Password PostgreSQL |
| `DB_NAME` | ✅ | Nombre de la base de datos |
| `NEXTAUTH_SECRET` | ✅ | Clave para JWT sessions (hex 64 chars) |
| `NEXTAUTH_URL` | ✅ | URL pública con https |
| `APP_URL` | ✅ | Igual que NEXTAUTH_URL |
| `APP_NAME` | ✅ | Nombre de la tienda |
| `ADMIN_EMAIL` | ⚡ | Email del admin inicial (solo primer deploy) |
| `ADMIN_PASSWORD` | ⚡ | Password del admin inicial |
| `ADMIN_NAME` | ⚡ | Nombre del admin inicial |
| `DOWNLOAD_SECRET` | ✅ | Clave para tokens de descarga |
| `IP_ENCRYPTION_KEY` | ✅ | Clave AES-256-GCM para cifrar IPs |
| `PAYPAL_*` | 🔧 | Configurar cuando PayPal esté listo |
| `S3_*` | 🔧 | Configurar cuando R2/S3 esté listo |
| `SMTP_*` | 🔧 | Configurar cuando email esté listo |
| `UPLOADS_DIR` | — | Se establece automáticamente (`/data/uploads`) |

✅ = obligatoria, ⚡ = solo primer deploy, 🔧 = configurar después

---

## 8) Seguridad

- App bindeada a `127.0.0.1` — no expuesta directamente
- PostgreSQL sin puerto en el host — solo red Docker interna
- Contenedor corre como usuario `nextjs` (UID 1001) — no root
- `NODE_ENV=production` fijo en la imagen
- JWT sessions con expiración de 8 horas
- Passwords: bcrypt con 12 rounds, validación de fuerza
- Admin deshabilitado no puede hacer login
- Audit log para todas las acciones de admin
- NGINX con rate-limit en endpoints de auth
- Cloudflare real IP restaurada con `CF-Connecting-IP`
- IPs de compradores cifradas con AES-256-GCM
- Log rotation para no llenar disco
- Uploads en volumen Docker nombrado (permisos garantizados)

---

## 9) Estructura de archivos del deploy

```
/opt/tienda/
└── app/                          ← repositorio clonado
    ├── .env.production           ← variables (NO en repo)
    ├── docker-compose.prod.yml   ← orquestación
    ├── Dockerfile                ← imagen multi-stage
    ├── docker/
    │   └── entrypoint.sh         ← migra + seed + permisos + arranca
    ├── scripts/
    │   ├── deploy.sh             ← deploy inicial (1 comando)
    │   ├── update.sh             ← actualización
    │   ├── install-nginx.sh      ← instalar vhost NGINX
    │   └── reset-admin.ts        ← reset admin de emergencia
    ├── nginx/
    │   └── tienda.template.conf  ← template NGINX parametrizable
    └── prisma/
        ├── schema.prisma
        └── migrations/           ← migraciones versionadas
```

Volúmenes Docker:
- `tienda-pgdata` → datos PostgreSQL
- `tienda-uploads` → archivos subidos (imágenes de productos)
