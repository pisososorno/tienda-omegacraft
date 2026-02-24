#!/bin/sh
set -e

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENTRYPOINT — TiendaDigital Production Container
# Runs as root briefly to fix perms, then execs app as nextjs
# NO npx, NO global prisma — only node + absolute paths
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRISMA_CLI="/app/node_modules/prisma/build/index.js"
UPLOADS_DIR="${UPLOADS_DIR:-/data/uploads}"

echo "[entrypoint] ┌─────────────────────────────────────────┐"
echo "[entrypoint] │  TiendaDigital — Production Entrypoint  │"
echo "[entrypoint] └─────────────────────────────────────────┘"

# ── 0) Verify Prisma CLI exists in image ─────────────────
if [ ! -f "$PRISMA_CLI" ]; then
  echo "[entrypoint] ✗ FATAL: Prisma CLI not found at $PRISMA_CLI"
  echo "[entrypoint]   Dockerfile runner stage must COPY node_modules/prisma from deps."
  exit 1
fi
echo "[entrypoint] ✓ Prisma CLI found: $PRISMA_CLI"

# ── 1) Ensure uploads directory exists with correct perms ──
echo "[entrypoint] Ensuring uploads directory: ${UPLOADS_DIR}"
mkdir -p "${UPLOADS_DIR}"
chown -R nextjs:nodejs "${UPLOADS_DIR}"
chmod -R 775 "${UPLOADS_DIR}"

# ── 2) Wait for PostgreSQL to be ready ─────────────────────
echo "[entrypoint] Waiting for PostgreSQL..."
MAX_RETRIES=30
RETRY=0
until node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.\$queryRaw\`SELECT 1\`.then(() => { p.\$disconnect(); process.exit(0); }).catch(() => { p.\$disconnect(); process.exit(1); });
" 2>/dev/null; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] ✗ PostgreSQL not reachable after ${MAX_RETRIES} attempts. Aborting."
    exit 1
  fi
  echo "[entrypoint]   waiting... (${RETRY}/${MAX_RETRIES})"
  sleep 2
done
echo "[entrypoint] ✓ PostgreSQL is ready"

# ── 3) Run Prisma migrations (absolute path, no npx) ─────
echo "[entrypoint] Running migrations..."
if node "$PRISMA_CLI" migrate deploy --schema=/app/prisma/schema.prisma; then
  echo "[entrypoint] ✓ Migrations applied successfully"
else
  echo "[entrypoint] ✗ Migration failed! Check DATABASE_URL and schema."
  echo "[entrypoint]   Run: docker compose -f docker-compose.prod.yml logs app"
  exit 1
fi

# ── 4) Conditional seed: create admin if none exists ──────
echo "[entrypoint] Checking if admin user exists..."
ADMIN_EXISTS=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.adminUser.count().then(c => { console.log(c); p.\$disconnect(); }).catch(() => { console.log('0'); p.\$disconnect(); });
" 2>/dev/null)

if [ "$ADMIN_EXISTS" = "0" ]; then
  echo "[entrypoint] No admin found. Creating initial admin..."

  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@tiendadigital.com}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
  ADMIN_NAME="${ADMIN_NAME:-Admin}"

  node -e "
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const p = new PrismaClient();
    (async () => {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
      await p.adminUser.create({
        data: {
          email: process.env.ADMIN_EMAIL || 'admin@tiendadigital.com',
          passwordHash: hash,
          name: process.env.ADMIN_NAME || 'Admin',
        },
      });
      await p.siteSettings.upsert({
        where: { id: 'default' },
        update: {},
        create: {
          id: 'default',
          storeName: process.env.APP_NAME || 'TiendaDigital',
          storeSlogan: 'Productos digitales premium para Minecraft',
          contactEmail: 'support@tiendadigital.com',
          privacyEmail: 'privacy@tiendadigital.com',
          heroTitle: 'Plugins, Maps y Configs de calidad profesional',
          heroDescription: 'Descubre nuestra colección de productos digitales para Minecraft.',
          appearance: {},
        },
      });
      const crypto = require('crypto');
      const content = 'Default terms - configure from admin panel';
      const hash2 = crypto.createHash('sha256').update(content).digest('hex');
      const existing = await p.termsVersion.findFirst({ where: { isActive: true } });
      if (!existing) {
        await p.termsVersion.create({
          data: {
            versionLabel: 'v1.0',
            content: content,
            contentHash: hash2,
            isActive: true,
          },
        });
      }
      await p.\$disconnect();
      console.log('[entrypoint] ✓ Admin created: ' + (process.env.ADMIN_EMAIL || 'admin@tiendadigital.com'));
    })().catch(e => { console.error('[entrypoint] ✗ Seed error:', e.message); p.\$disconnect(); process.exit(1); });
  "
else
  echo "[entrypoint] ✓ Admin already exists (${ADMIN_EXISTS} admin user(s))"
fi

# ── 5) Start the application as non-root user ────────────
echo "[entrypoint] Starting Next.js server as user nextjs (PID $$)..."
exec gosu nextjs node server.js
