#!/usr/bin/env bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# install-nginx.sh — Install NGINX vhost for TiendaDigital
# Usage: sudo bash scripts/install-nginx.sh [domain]
# Example: sudo bash scripts/install-nginx.sh tienda.omegacraft.cl
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$PROJECT_DIR/nginx/tienda.template.conf"

DOMAIN="${1:-tienda.omegacraft.cl}"
UPSTREAM="${2:-127.0.0.1:3000}"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "┌──────────────────────────────────────────────┐"
echo "│   TiendaDigital — NGINX Installer            │"
echo "└──────────────────────────────────────────────┘"
echo -e "${NC}"

# ── Check privileges ─────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}✗ This script must be run as root (use sudo)${NC}"
  exit 1
fi

# ── Check NGINX installed ────────────────────────────────
if ! command -v nginx &>/dev/null; then
  echo -e "${RED}✗ NGINX not found. Install: apt install nginx${NC}"
  exit 1
fi

# ── Check template exists ────────────────────────────────
if [ ! -f "$TEMPLATE" ]; then
  echo -e "${RED}✗ Template not found: $TEMPLATE${NC}"
  exit 1
fi

DEST="/etc/nginx/sites-available/${DOMAIN}"
LINK="/etc/nginx/sites-enabled/${DOMAIN}"

echo -e "${YELLOW}Domain:   ${NC}${DOMAIN}"
echo -e "${YELLOW}Upstream: ${NC}${UPSTREAM}"
echo -e "${YELLOW}Config:   ${NC}${DEST}"
echo ""

# ── Install rate-limit zone in http context ──────────────
RATELIMIT_CONF="/etc/nginx/conf.d/tienda-ratelimit.conf"
echo -e "${YELLOW}[1/5] Installing rate-limit zone...${NC}"
if [ ! -f "$RATELIMIT_CONF" ]; then
  echo 'limit_req_zone $binary_remote_addr zone=tienda_auth:10m rate=5r/s;' > "$RATELIMIT_CONF"
  echo "  ✓ Created $RATELIMIT_CONF"
else
  echo "  ✓ Already exists: $RATELIMIT_CONF"
fi

# ── Generate config from template ────────────────────────
echo -e "${YELLOW}[2/5] Generating NGINX config...${NC}"
# Filter out comment-only lines at the top of the template (rate-limit notes)
sed \
  -e "s|\${DOMAIN}|${DOMAIN}|g" \
  -e "s|\${UPSTREAM}|${UPSTREAM}|g" \
  "$TEMPLATE" | grep -v '^# .*limit_req_zone' | grep -v '^# File:' > "$DEST"
echo "  ✓ Config written to $DEST"

# ── Enable site ──────────────────────────────────────────
echo -e "${YELLOW}[3/5] Enabling site...${NC}"
if [ -L "$LINK" ]; then
  rm "$LINK"
fi
ln -s "$DEST" "$LINK"
echo "  ✓ Symlink created"

# ── Test config ──────────────────────────────────────────
echo -e "${YELLOW}[4/5] Testing NGINX config...${NC}"
if nginx -t 2>&1; then
  echo "  ✓ Config valid"
else
  echo -e "${RED}✗ NGINX config test failed. Removing symlink.${NC}"
  rm -f "$LINK"
  exit 1
fi

# ── Reload NGINX ─────────────────────────────────────────
echo -e "${YELLOW}[5/5] Reloading NGINX...${NC}"
systemctl reload nginx
echo "  ✓ NGINX reloaded"

echo ""
echo -e "${GREEN}✓ NGINX vhost installed for ${DOMAIN}${NC}"
echo ""
echo "  Next steps:"
echo "    1. Point DNS A record for ${DOMAIN} → your server IP"
echo "    2. Enable Cloudflare proxy (orange cloud)"
echo "    3. Set SSL mode to 'Full' in Cloudflare"
echo ""
echo "  Test:"
echo -e "    ${CYAN}curl -s -H 'Host: ${DOMAIN}' http://127.0.0.1/api/health${NC}"
echo ""
