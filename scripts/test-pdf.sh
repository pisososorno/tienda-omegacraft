#!/usr/bin/env bash
# ──────────────────────────────────────────────────
# test-pdf.sh — Prueba mínima del endpoint evidence-pdf
# Uso: bash scripts/test-pdf.sh <ORDER_ID> <COOKIE>
#
# Ejemplo:
#   bash scripts/test-pdf.sh d749738f-bff7-4744-8841-732b87e19cf0 "next-auth.session-token=abc123"
# ──────────────────────────────────────────────────
set -euo pipefail

ORDER_ID="${1:?Uso: bash scripts/test-pdf.sh <ORDER_ID> <COOKIE>}"
COOKIE="${2:?Proporciona la cookie de sesión admin}"
BASE_URL="${3:-https://tienda.omegacraft.cl}"

URL="${BASE_URL}/api/admin/orders/${ORDER_ID}/evidence-pdf"
OUT="/tmp/evidence-${ORDER_ID}.pdf"

echo "▸ Probando: ${URL}"
HTTP_CODE=$(curl -sS -o "${OUT}" -w "%{http_code}" \
  -H "Cookie: ${COOKIE}" \
  "${URL}")

CONTENT_TYPE=$(curl -sS -o /dev/null -w "%{content_type}" \
  -H "Cookie: ${COOKIE}" \
  "${URL}")

echo "▸ HTTP Status:  ${HTTP_CODE}"
echo "▸ Content-Type: ${CONTENT_TYPE}"
echo "▸ File size:    $(wc -c < "${OUT}") bytes"

if [[ "${HTTP_CODE}" == "200" ]] && [[ "${CONTENT_TYPE}" == *"application/pdf"* ]]; then
  echo "✓ PDF generado correctamente → ${OUT}"
  # Verificar que comienza con %PDF
  HEAD=$(head -c 5 "${OUT}")
  if [[ "${HEAD}" == "%PDF-" ]]; then
    echo "✓ Archivo es un PDF válido (header %PDF-)"
  else
    echo "✗ El archivo NO comienza con %PDF- — posible error"
    exit 1
  fi
else
  echo "✗ FALLO: HTTP ${HTTP_CODE}, Content-Type: ${CONTENT_TYPE}"
  echo "▸ Respuesta:"
  cat "${OUT}"
  exit 1
fi
