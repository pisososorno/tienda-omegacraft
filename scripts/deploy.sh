#!/usr/bin/env bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# deploy.sh — TiendaDigital Enterprise Deploy (1-command)
# Usage: bash scripts/deploy.sh
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.production"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "┌──────────────────────────────────────────────┐"
echo "│   TiendaDigital — Enterprise Deploy Script   │"
echo "└──────────────────────────────────────────────┘"
echo -e "${NC}"

# ── 1) Validate dependencies ─────────────────────────────
echo -e "${YELLOW}[1/6] Validating dependencies...${NC}"

if ! command -v docker &>/dev/null; then
  echo -e "${RED}✗ Docker is not installed. Install it first: https://docs.docker.com/engine/install/ubuntu/${NC}"
  exit 1
fi
echo "  ✓ docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"

if ! docker compose version &>/dev/null; then
  echo -e "${RED}✗ Docker Compose plugin not found. Install: apt install docker-compose-plugin${NC}"
  exit 1
fi
echo "  ✓ docker compose $(docker compose version --short)"

# ── 2) Create/validate .env.production ───────────────────
echo ""
echo -e "${YELLOW}[2/6] Checking environment file...${NC}"

REQUIRED_VARS=(
  "DATABASE_URL"
  "DB_USER"
  "DB_PASSWORD"
  "DB_NAME"
  "NEXTAUTH_SECRET"
  "NEXTAUTH_URL"
  "APP_URL"
  "APP_NAME"
)

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}  .env.production not found. Creating from template...${NC}"

  if [ -f "$PROJECT_DIR/.env.production.example" ]; then
    cp "$PROJECT_DIR/.env.production.example" "$ENV_FILE"
  else
    echo -e "${RED}✗ .env.production.example not found either. Cannot continue.${NC}"
    exit 1
  fi

  # Auto-generate secrets if they have placeholder values
  for VAR in NEXTAUTH_SECRET DOWNLOAD_SECRET IP_ENCRYPTION_KEY; do
    CURRENT=$(grep "^${VAR}=" "$ENV_FILE" | cut -d'"' -f2 || true)
    if [[ -z "$CURRENT" || "$CURRENT" == "CHANGE_ME"* ]]; then
      SECRET=$(openssl rand -hex 32)
      sed -i "s|^${VAR}=.*|${VAR}=\"${SECRET}\"|" "$ENV_FILE"
      echo "  ✓ Generated ${VAR}"
    fi
  done

  # Generate DB password if placeholder
  DB_PASS_CURRENT=$(grep "^DB_PASSWORD=" "$ENV_FILE" | cut -d'"' -f2 || true)
  if [[ -z "$DB_PASS_CURRENT" || "$DB_PASS_CURRENT" == "CHANGE_ME"* ]]; then
    DB_PASS=$(openssl rand -hex 16)
    sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=\"${DB_PASS}\"|" "$ENV_FILE"
    # Also update DATABASE_URL with the new password
    sed -i "s|DB_PASSWORD_HERE|${DB_PASS}|g" "$ENV_FILE"
    echo "  ✓ Generated DB_PASSWORD"
  fi

  echo ""
  echo -e "${YELLOW}  ⚠  IMPORTANT: Review and edit .env.production before continuing:${NC}"
  echo -e "     ${CYAN}nano $ENV_FILE${NC}"
  echo ""
  echo "  Required values to set manually:"
  echo "    - NEXTAUTH_URL (your domain, e.g., https://tienda.omegacraft.cl)"
  echo "    - APP_URL (same as NEXTAUTH_URL)"
  echo "    - APP_NAME (your store name)"
  echo "    - ADMIN_EMAIL / ADMIN_PASSWORD (initial admin credentials)"
  echo "    - PAYPAL_* (when ready for payments)"
  echo "    - S3_* (when ready for file storage)"
  echo "    - SMTP_* (when ready for emails)"
  echo ""
  read -rp "  Press ENTER when .env.production is ready, or Ctrl+C to abort... "
fi

# Validate required variables exist
MISSING=()
for VAR in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${VAR}=" "$ENV_FILE" 2>/dev/null; then
    MISSING+=("$VAR")
  else
    VALUE=$(grep "^${VAR}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"')
    if [[ -z "$VALUE" || "$VALUE" == "CHANGE_ME"* ]]; then
      MISSING+=("$VAR")
    fi
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo -e "${RED}✗ Missing or placeholder values in .env.production:${NC}"
  for VAR in "${MISSING[@]}"; do
    echo "    - $VAR"
  done
  echo ""
  echo -e "  Edit: ${CYAN}nano $ENV_FILE${NC}"
  exit 1
fi
echo "  ✓ All required variables present"

# ── 3) Build and start services ──────────────────────────
echo ""
echo -e "${YELLOW}[3/6] Building and starting containers...${NC}"
cd "$PROJECT_DIR"
docker compose -f "$COMPOSE_FILE" up -d --build

# ── 4) Wait for health ───────────────────────────────────
echo ""
echo -e "${YELLOW}[4/6] Waiting for services to be healthy...${NC}"

echo "  Waiting for PostgreSQL..."
RETRIES=0
until docker exec tienda-postgres pg_isready -U "$(grep '^DB_USER=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')" &>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge 30 ]; then
    echo -e "${RED}✗ PostgreSQL did not become ready${NC}"
    docker compose -f "$COMPOSE_FILE" logs postgres
    exit 1
  fi
  sleep 2
done
echo "  ✓ PostgreSQL ready"

echo "  Waiting for app (migrations + startup, up to 90s)..."
RETRIES=0
until curl -sf http://127.0.0.1:3000/api/health &>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge 45 ]; then
    echo -e "${RED}✗ App did not become healthy. Check logs:${NC}"
    echo -e "  ${CYAN}docker compose -f docker-compose.prod.yml logs app${NC}"
    exit 1
  fi
  sleep 2
done
echo "  ✓ App healthy"

# ── 5) Show status ───────────────────────────────────────
echo ""
echo -e "${YELLOW}[5/6] Service status:${NC}"
docker compose -f "$COMPOSE_FILE" ps

# ── 6) Summary ───────────────────────────────────────────
APP_URL=$(grep '^APP_URL=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"')
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' || echo "admin@tiendadigital.com")

echo ""
echo -e "${GREEN}┌──────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}│          ✓ Deploy completed!                 │${NC}"
echo -e "${GREEN}└──────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  App URL:     ${CYAN}${APP_URL}${NC}"
echo -e "  Admin:       ${CYAN}${APP_URL}/admin${NC}"
echo -e "  Admin email: ${CYAN}${ADMIN_EMAIL}${NC}"
echo -e "  Health:      ${CYAN}curl http://127.0.0.1:3000/api/health${NC}"
echo ""
echo "  Useful commands:"
echo -e "    Logs:        ${CYAN}docker compose -f docker-compose.prod.yml logs -f app${NC}"
echo -e "    DB logs:     ${CYAN}docker compose -f docker-compose.prod.yml logs -f postgres${NC}"
echo -e "    Status:      ${CYAN}docker compose -f docker-compose.prod.yml ps${NC}"
echo -e "    Restart:     ${CYAN}docker compose -f docker-compose.prod.yml restart app${NC}"
echo -e "    Shell:       ${CYAN}docker exec -it tienda-app sh${NC}"
echo -e "    DB backup:   ${CYAN}docker exec tienda-postgres pg_dump -U tienda tienda_digital > backup.sql${NC}"
echo ""
echo -e "  ${YELLOW}Next step: Configure NGINX reverse proxy${NC}"
echo -e "    ${CYAN}bash scripts/install-nginx.sh${NC}"
echo ""
