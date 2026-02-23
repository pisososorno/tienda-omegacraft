#!/usr/bin/env bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# update.sh — TiendaDigital Zero-Downtime Update
# Usage: bash scripts/update.sh
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "┌──────────────────────────────────────────────┐"
echo "│   TiendaDigital — Update Script              │"
echo "└──────────────────────────────────────────────┘"
echo -e "${NC}"

cd "$PROJECT_DIR"

# ── 1) Pull latest code ──────────────────────────────────
echo -e "${YELLOW}[1/4] Pulling latest code...${NC}"
git pull --ff-only
echo "  ✓ Code updated"

# ── 2) Rebuild image ─────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/4] Rebuilding Docker image...${NC}"
docker compose -f "$COMPOSE_FILE" build app
echo "  ✓ Image rebuilt"

# ── 3) Recreate app container (entrypoint handles migrations) ──
echo ""
echo -e "${YELLOW}[3/4] Restarting app container...${NC}"
docker compose -f "$COMPOSE_FILE" up -d app
echo "  ✓ Container restarted"

# ── 4) Wait for health ───────────────────────────────────
echo ""
echo -e "${YELLOW}[4/4] Waiting for app to be healthy...${NC}"
RETRIES=0
until curl -sf http://127.0.0.1:3000/api/health &>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge 45 ]; then
    echo -e "${RED}✗ App did not become healthy after update.${NC}"
    echo -e "  Check logs: ${CYAN}docker compose -f docker-compose.prod.yml logs -f app${NC}"
    exit 1
  fi
  sleep 2
done

echo ""
echo -e "${GREEN}✓ Update complete! App is healthy.${NC}"
echo -e "  Health: ${CYAN}$(curl -s http://127.0.0.1:3000/api/health)${NC}"
echo ""

# Clean up old images
echo -e "${YELLOW}Cleaning up unused Docker images...${NC}"
docker image prune -f --filter "label=com.docker.compose.project=tienda" 2>/dev/null || true
echo "  ✓ Cleanup done"
