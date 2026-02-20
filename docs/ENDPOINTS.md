# ENDPOINTS API — Referencia Completa

## Públicos (Sin auth)

### Productos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/products` | Lista productos activos. Query: `category`, `page`, `limit`, `search` |
| GET | `/api/products/[slug]` | Detalle de producto por slug |

### Términos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/terms/active` | Retorna términos activos (versión actual) |

### Checkout
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/checkout/create-order` | Crea orden interna + PayPal Order |
| POST | `/api/checkout/capture-order` | Captura pago en PayPal |

### Descargas
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/download/request` | Genera token de descarga firmado |
| GET | `/api/download/file?token=XXX` | Sirve archivo (stream desde S3/R2) |

### Webhook
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/webhook/paypal` | Recibe webhooks PayPal |

---

## Admin (Protegidos por NextAuth)

### Órdenes
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/orders` | Lista órdenes con filtros |
| GET | `/api/admin/orders/[id]` | Detalle orden + timeline + license + stages |
| POST | `/api/admin/orders/[id]/revoke` | Revoca descargas (mantiene logs) |
| GET | `/api/admin/orders/[id]/evidence-pdf` | Genera y retorna PDF de evidencia (application/pdf) |
| POST | `/api/admin/orders/[id]/stages/[stageId]/release` | **(F)** Libera etapa de entrega |
| POST | `/api/admin/orders/[id]/dispute-mode` | **(J)** Activa dispute mode: freeze + PDF final |
| GET | `/api/admin/orders/[id]/frozen-evidence` | **(J)** Descarga PDF congelado |
| GET | `/api/admin/orders/[id]/verify-chain` | **(A)** Verifica integridad hash chain |

### Productos
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/admin/products` | Crear producto |
| PUT | `/api/admin/products/[id]` | Actualizar producto |
| DELETE | `/api/admin/products/[id]` | Soft-delete (is_active=false) |
| POST | `/api/admin/products/[id]/files` | Subir archivo (multipart) |
| DELETE | `/api/admin/products/[id]/files/[fileId]` | Eliminar archivo |
| POST | `/api/admin/products/[id]/images` | Subir imagen |
| DELETE | `/api/admin/products/[id]/images/[imageId]` | Eliminar imagen |

### Términos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/terms` | Lista todas las versiones |
| POST | `/api/admin/terms` | Crear nueva versión |
| PUT | `/api/admin/terms/[id]/activate` | Activar versión (desactiva las demás) |

### Dashboard
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/stats` | Stats: ventas recientes, totales, disputas |

---

## Payloads JSON Detallados

### POST `/api/checkout/create-order`
```json
// REQUEST
{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "buyer_email": "comprador@gmail.com",
  "terms_version_id": "660e8400-e29b-41d4-a716-446655440001",
  "terms_accepted": true
}
// Server captura automáticamente: IP (x-forwarded-for), User-Agent

// RESPONSE 201
{
  "order_id": "770e8400-e29b-41d4-a716-446655440002",
  "order_number": "ORD-A3F8K2",
  "paypal_order_id": "5O190127TN364715T"
}

// ERROR 400
{
  "error": "TERMS_NOT_ACCEPTED",
  "message": "Debe aceptar los términos y condiciones"
}
```

### POST `/api/checkout/capture-order`
```json
// REQUEST
{
  "order_id": "770e8400-e29b-41d4-a716-446655440002",
  "paypal_order_id": "5O190127TN364715T"
}

// RESPONSE 200
{
  "success": true,
  "order_number": "ORD-A3F8K2",
  "status": "paid",
  "download_url": "/downloads/ORD-A3F8K2"
}

// ERROR 400
{
  "error": "PAYMENT_NOT_COMPLETED",
  "message": "El pago no fue completado en PayPal"
}
```

### POST `/api/download/request`
```json
// REQUEST
{
  "order_number": "ORD-A3F8K2",
  "email": "comprador@gmail.com"
}

// RESPONSE 200
{
  "download_url": "/api/download/file?token=eyJvcmRlcl9pZCI6Ij...",
  "expires_in_seconds": 900,
  "downloads_remaining": 2,
  "downloads_expire_at": "2026-02-19T15:00:00.000Z"
}

// ERROR 403
{
  "error": "DOWNLOAD_LIMIT_REACHED",
  "message": "Ha alcanzado el límite de descargas para esta orden"
}

// ERROR 403
{
  "error": "DOWNLOADS_EXPIRED",
  "message": "El período de descarga para esta orden ha expirado"
}

// ERROR 403
{
  "error": "DOWNLOADS_REVOKED",
  "message": "Las descargas para esta orden han sido revocadas"
}
```

### GET `/api/admin/orders/[id]`
```json
// RESPONSE 200
{
  "order": {
    "id": "770e8400-...",
    "orderNumber": "ORD-A3F8K2",
    "buyerEmail": "comprador@gmail.com",
    "buyerIp": "190.xxx.xxx.xxx",
    "buyerUserAgent": "Mozilla/5.0 ...",
    "buyerCountry": "Argentina",
    "buyerCity": "Buenos Aires",
    "amountUsd": "450.00",
    "currency": "USD",
    "status": "confirmed",
    "paypalOrderId": "5O190127TN364715T",
    "paypalCaptureId": "9XY12345AB678901C",
    "paypalPayerEmail": "comprador@gmail.com",
    "paypalPayerId": "BUYERID123",
    "paypalStatus": "COMPLETED",
    "downloadLimit": 3,
    "downloadCount": 2,
    "downloadsExpireAt": "2026-02-19T15:00:00.000Z",
    "downloadsRevoked": false,
    "deliveryPackageHash": "a1b2c3d4e5f6...",
    "productSnapshot": {
      "name": "Custom KitPvP Plugin",
      "category": "source_code",
      "price_usd": "450.00",
      "description": "...",
      "metadata": {"mc_versions": ["1.20","1.21"], "platforms": ["Paper"]}
    },
    "termsVersion": {
      "versionLabel": "v1.2",
      "contentHash": "abc123..."
    },
    "termsAcceptedAt": "2026-02-12T14:58:30.000Z",
    "termsAcceptedIp": "190.xxx.xxx.xxx",
    "createdAt": "2026-02-12T14:58:45.000Z"
  },
  "events": [
    {
      "id": "...",
      "eventType": "order.created",
      "eventData": {},
      "ipAddress": "190.xxx.xxx.xxx",
      "userAgent": "Mozilla/5.0 ...",
      "createdAt": "2026-02-12T14:58:45.000Z"
    },
    {
      "id": "...",
      "eventType": "terms.accepted",
      "eventData": {"version": "v1.2", "content_hash": "abc123..."},
      "ipAddress": "190.xxx.xxx.xxx",
      "createdAt": "2026-02-12T14:58:30.000Z"
    }
  ],
  "license": {
    "licenseKey": "LIC-A1B2-C3D4-E5F6",
    "fingerprint": "abc123def456...",
    "status": "active",
    "createdAt": "2026-02-12T15:00:25.000Z"
  }
}
```

### POST `/api/admin/products`
```json
// REQUEST (multipart/json — archivos se suben por separado)
{
  "slug": "custom-kitpvp-plugin",
  "name": "Custom KitPvP Plugin",
  "description": "## Features\n- Custom kits\n- Arena system\n...",
  "category": "source_code",
  "price_usd": 450.00,
  "metadata": {
    "mc_versions": ["1.20", "1.21"],
    "platforms": ["Paper"],
    "tags": ["pvp", "plugin", "custom"],
    "changelog": "v2.1 - Added arena rotation"
  },
  "download_limit": 3,
  "download_expires_days": 7
}

// RESPONSE 201
{
  "id": "550e8400-...",
  "slug": "custom-kitpvp-plugin",
  "name": "Custom KitPvP Plugin",
  "createdAt": "2026-02-12T12:00:00.000Z"
}
```

### POST `/api/admin/terms`
```json
// REQUEST
{
  "version_label": "v1.3",
  "content": "# Terms and Conditions\n\n## 1. Digital Products\n..."
}
// Server calcula content_hash automáticamente (SHA256)

// RESPONSE 201
{
  "id": "660e8400-...",
  "versionLabel": "v1.3",
  "contentHash": "sha256_of_content",
  "isActive": false,
  "createdAt": "2026-02-12T12:00:00.000Z"
}
```

### POST `/api/admin/orders/[id]/stages/[stageId]/release` (F)
```json
// RESPONSE 200
{
  "success": true,
  "stage_type": "full",
  "status": "ready",
  "released_at": "2026-02-13T10:00:00.000Z"
}

// ERROR 400
{
  "error": "STAGE_ALREADY_RELEASED",
  "message": "Esta etapa ya fue liberada"
}
```

### POST `/api/admin/orders/[id]/dispute-mode` (J)
```json
// REQUEST: no body required

// RESPONSE 200
{
  "success": true,
  "evidenceFrozenAt": "2026-02-20T14:00:00.000Z",
  "frozenBy": "admin@tiendadigital.com",
  "chainValid": true,
  "chainTotalEvents": 14,
  "frozenEvidencePdfKey": "evidence/ORD-A3F8K2/evidence-ORD-A3F8K2-2026-02-20.pdf",
  "pdfHash": "sha256...",
  "pdfSizeBytes": 45230,
  "documentId": "EVD-ORD-A3F8K2-1740063600000",
  "message": "Dispute mode activated. Evidence frozen. PDF generated and uploaded. Downloads revoked."
}

// Flow interno:
// 1. Verifica integridad de la cadena de eventos.
// 2. Congela orden (status=frozen, evidenceFrozenAt, evidenceFrozenByAdmin).
// 3. Revoca descargas.
// 4. Registra eventos: admin.dispute_mode_activated, admin.downloads_revoked.
// 5. Genera PDF de evidencia real (@react-pdf/renderer).
// 6. Sube PDF a S3/R2.
// 7. Guarda frozenEvidencePdfKey en la orden.
// 8. Registra evento: admin.evidence_pdf_generated.

// ERROR 409
{
  "error": "Evidence already frozen for this order"
}
```

### GET `/api/admin/orders/[id]/frozen-evidence` (J)
```json
// RESPONSE 200: application/pdf (stream binario)
// Headers:
//   Content-Type: application/pdf
//   Content-Disposition: attachment; filename="evidence-ORD-A3F8K2-2026-02-20.pdf"
//   X-Evidence-Frozen-At: 2026-02-20T14:00:00.000Z
//   Cache-Control: no-store

// ERROR 404
{
  "error": "No frozen evidence PDF available. Activate dispute mode first."
}

// ERROR 401
{
  "error": "Unauthorized"
}
```

### POST `/api/admin/orders/[id]/revoke`
```json
// REQUEST (body opcional)
{
  "reason": "Refund granted"
}

// RESPONSE 200
{
  "success": true,
  "orderId": "770e8400-...",
  "orderNumber": "ORD-A3F8K2",
  "downloadsRevoked": true,
  "stagesRevoked": 2,
  "reason": "Refund granted",
  "revokedBy": "admin@tiendadigital.com",
  "message": "Downloads revoked. Delivery stages revoked. Event chain updated."
}

// Nota: NO congela evidencia (no activa dispute mode).
// Los logs append-only NO se borran.
// Registra eventos: admin.downloads_revoked, admin.stages_revoked (si aplica).

// ERROR 409
{
  "error": "Downloads already revoked for this order"
}

// ERROR 404
{
  "error": "Order not found"
}
```

### GET `/api/admin/orders/[id]/verify-chain` (A)
```json
// RESPONSE 200
{
  "valid": true,
  "total_events": 14,
  "first_event_at": "2026-02-12T14:58:30.000Z",
  "last_event_at": "2026-02-16T10:00:00.000Z",
  "broken_at_sequence": null
}

// RESPONSE 200 (chain broken)
{
  "valid": false,
  "total_events": 14,
  "first_event_at": "2026-02-12T14:58:30.000Z",
  "last_event_at": "2026-02-16T10:00:00.000Z",
  "broken_at_sequence": 7,
  "expected_hash": "abc123...",
  "actual_hash": "def456..."
}
```

### GET `/api/admin/orders/[id]` (actualizado con stages + snapshots)
```json
// RESPONSE 200 (campos nuevos respecto a versión anterior)
{
  "order": {
    "...campos anteriores...",
    "evidenceFrozenAt": null,
    "frozenEvidencePdfKey": null,
    "retentionExpiresAt": "2027-08-07T14:58:45.000Z"
  },
  "events": [
    {
      "id": "...",
      "sequenceNumber": 1,
      "eventType": "order.created",
      "eventData": {},
      "ipAddress": "190.xxx.xxx.xxx",
      "externalRef": null,
      "eventHash": "a3f8c2e91b...",
      "prevHash": null,
      "createdAt": "2026-02-12T14:58:45.000Z"
    }
  ],
  "license": { "..." },
  "snapshots": [
    {
      "id": "...",
      "snapshotType": "json",
      "snapshotHash": "abc123...",
      "createdAt": "2026-02-12T15:00:00.000Z"
    },
    {
      "id": "...",
      "snapshotType": "html",
      "snapshotHtmlKey": "snapshots/{order_id}/product-page.html",
      "snapshotHash": "def456...",
      "createdAt": "2026-02-12T15:00:02.000Z"
    },
    {
      "id": "...",
      "snapshotType": "pdf",
      "snapshotPdfKey": "snapshots/{order_id}/product-page.pdf",
      "snapshotHash": "ghi789...",
      "createdAt": "2026-02-12T15:00:03.000Z"
    }
  ],
  "stages": [
    {
      "id": "...",
      "stageType": "preview",
      "stageOrder": 1,
      "status": "delivered",
      "sha256Hash": "aaa111...",
      "filename": "KitPvP-v2.1-demo.jar",
      "downloadLimit": 3,
      "downloadCount": 2,
      "releasedAt": "2026-02-12T15:00:25.000Z"
    },
    {
      "id": "...",
      "stageType": "full",
      "stageOrder": 2,
      "status": "ready",
      "sha256Hash": "bbb222...",
      "filename": "KitPvP-v2.1-source.zip",
      "downloadLimit": 3,
      "downloadCount": 0,
      "releasedAt": "2026-02-13T10:00:00.000Z"
    }
  ],
  "chainIntegrity": {
    "valid": true,
    "totalEvents": 14
  }
}
```

### POST `/api/webhook/paypal`
```json
// PayPal envía (ejemplo PAYMENT.CAPTURE.COMPLETED):
{
  "id": "WH-2WR32451HC608454T-5W507613HL206511T",
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource_type": "capture",
  "resource": {
    "id": "9XY12345AB678901C",
    "status": "COMPLETED",
    "amount": {
      "currency_code": "USD",
      "value": "450.00"
    },
    "custom_id": "770e8400-e29b-41d4-a716-446655440002",
    "supplementary_data": {
      "related_ids": {
        "order_id": "5O190127TN364715T"
      }
    }
  },
  "create_time": "2026-02-12T15:00:18.000Z"
}

// Headers de verificación que PayPal incluye:
// paypal-transmission-id: xxx
// paypal-transmission-sig: xxx
// paypal-cert-url: xxx
// paypal-transmission-time: xxx
// paypal-auth-algo: SHA256withRSA

// RESPONSE: 200 OK (siempre, para que PayPal no reintente innecesariamente)
```
