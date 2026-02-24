# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Dockerfile — TiendaDigital Enterprise Production Build
# Pinned: node:20.18-slim (Debian bookworm), Prisma 5.x
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FROM node:20.18-slim AS base

# ── Stage 1: Install dependencies ─────────────────────────
FROM base AS deps
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
# Generate Prisma client explicitly with project version
COPY prisma ./prisma
RUN npx prisma generate

# ── Stage 2: Build application ────────────────────────────
FROM base AS builder
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# ── Stage 3: Production runtime ──────────────────────────
FROM base AS runner
RUN apt-get update -y && apt-get install -y openssl ca-certificates gosu && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma CLI + client + schema + migrations (needed for migrate deploy in entrypoint)
COPY --from=deps /app/node_modules/.bin ./node_modules/.bin
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

# Copy bcryptjs for entrypoint seed logic
COPY --from=deps /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy entrypoint
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Create uploads directory (will be mounted as volume)
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data/uploads && chmod -R 775 /data/uploads

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV UPLOADS_DIR="/data/uploads"

# Entrypoint runs as root (fixes perms, migrates, seeds) then execs as nextjs
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
