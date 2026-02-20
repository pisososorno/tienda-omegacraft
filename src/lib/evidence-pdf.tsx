import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// ── Types ────────────────────────────────────────────
export interface EvidenceOrderData {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: Date;
  buyerName: string;
  buyerEmail: string;
  buyerIp: string | null;
  buyerCountry: string | null;
  buyerCity: string | null;
  amountUsd: unknown; // Decimal
  currency: string;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  paypalPayerId: string | null;
  paypalPayerName: string | null;
  paypalPayerEmail: string | null;
  paypalStatus: string | null;
  paypalWebhookReceivedAt: Date | null;
  downloadCount: number;
  downloadLimit: number;
  downloadsExpireAt: Date | null;
  downloadsRevoked: boolean;
  evidenceFrozenAt: Date | null;
  evidenceFrozenByAdmin: string | null;
  retentionExpiresAt: Date | null;
  termsAcceptedAt: Date;
  termsAcceptedIp: string | null;
  termsAcceptedUa: string | null;
  product: {
    name: string;
    slug: string;
    category: string;
  };
  termsVersion: {
    versionLabel: string;
    contentHash: string;
    content: string;
  };
  events: Array<{
    sequenceNumber: number;
    eventType: string;
    eventData: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    externalRef: string | null;
    prevHash: string | null;
    eventHash: string;
    createdAt: Date;
  }>;
  license: {
    licenseKey: string;
    fingerprint: string;
    status: string;
    createdAt: Date;
  } | null;
  snapshots: Array<{
    snapshotType: string;
    snapshotHash: string;
    snapshotHtmlKey: string | null;
    snapshotPdfKey: string | null;
    createdAt: Date;
  }>;
  deliveryStages: Array<{
    stageOrder: number;
    stageType: string;
    status: string;
    filename: string | null;
    sha256Hash: string | null;
    downloadCount: number;
    downloadLimit: number;
    releasedAt: Date | null;
  }>;
}

export interface ChainResult {
  valid: boolean;
  totalEvents: number;
  firstEventAt: Date | null;
  lastEventAt: Date | null;
  brokenAtSequence: number | null;
}

// ── Styles ───────────────────────────────────────────
const colors = {
  primary: "#1e293b",
  secondary: "#334155",
  accent: "#2563eb",
  success: "#059669",
  danger: "#dc2626",
  warning: "#d97706",
  bg: "#ffffff",
  bgAlt: "#f8fafc",
  border: "#e2e8f0",
  textPrimary: "#1e293b",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: colors.textPrimary,
    backgroundColor: colors.bg,
  },
  // Header
  header: {
    backgroundColor: colors.primary,
    padding: 20,
    marginBottom: 20,
    borderRadius: 4,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  headerSubtitle: {
    color: "#cbd5e1",
    fontSize: 9,
    textAlign: "center",
  },
  // Sections
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    paddingBottom: 4,
    marginBottom: 8,
  },
  // Key-value rows
  row: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  label: {
    width: 140,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.textSecondary,
  },
  value: {
    flex: 1,
    fontSize: 8,
  },
  // Tables
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 2,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgAlt,
  },
  tableCell: {
    fontSize: 7,
  },
  // Status badges
  badgeValid: {
    backgroundColor: "#dcfce7",
    color: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  badgeBroken: {
    backgroundColor: "#fef2f2",
    color: colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: colors.textMuted,
  },
  // Chain event block
  chainBlock: {
    marginBottom: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  chainSeq: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.accent,
  },
  chainDetail: {
    fontSize: 7,
    color: colors.textSecondary,
  },
  chainHash: {
    fontSize: 6,
    color: colors.textMuted,
    fontFamily: "Courier",
  },
  // Warning box
  warningBox: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    padding: 8,
    marginBottom: 10,
    borderRadius: 2,
  },
  warningText: {
    fontSize: 8,
    color: "#92400e",
  },
  // Dispute freeze box
  frozenBox: {
    backgroundColor: "#fef2f2",
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    padding: 8,
    marginBottom: 10,
    borderRadius: 2,
  },
  frozenText: {
    fontSize: 8,
    color: colors.danger,
    fontFamily: "Helvetica-Bold",
  },
});

// ── Helpers ──────────────────────────────────────────
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "N/A";
  return new Date(d).toISOString();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max) + "..." : s;
}

// ── Row Component ────────────────────────────────────
function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

// ── Document Component ───────────────────────────────
function EvidenceDocument({
  order,
  chain,
  generatedBy,
  generatedAt,
  documentId,
  storeName,
}: {
  order: EvidenceOrderData;
  chain: ChainResult;
  generatedBy: string;
  generatedAt: Date;
  documentId: string;
  storeName: string;
}) {
  const downloadEvents = order.events.filter((e) =>
    e.eventType.startsWith("download.")
  );
  const emailEvents = order.events.filter((e) =>
    e.eventType.startsWith("email.")
  );
  const adminEvents = order.events.filter((e) =>
    e.eventType.startsWith("admin.")
  );
  const accessEvents = order.events.filter(
    (e) => e.eventType === "download.access_page_viewed"
  );

  return (
    <Document
      title={`Evidence Pack — ${order.orderNumber}`}
      author={`${storeName} Forensic Engine`}
      subject="Chargeback Defense Evidence"
    >
      {/* ── PAGE 1: Order Summary + Payment + Terms ── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            EVIDENCE PACK — CHARGEBACK DEFENSE
          </Text>
          <Text style={styles.headerSubtitle}>
            Document {documentId} | Generated {fmtDate(generatedAt)} by{" "}
            {generatedBy}
          </Text>
        </View>

        {order.evidenceFrozenAt && (
          <View style={styles.frozenBox}>
            <Text style={styles.frozenText}>
              DISPUTE MODE ACTIVE — Evidence frozen at{" "}
              {fmtDate(order.evidenceFrozenAt)} by{" "}
              {order.evidenceFrozenByAdmin || "N/A"}
            </Text>
          </View>
        )}

        {/* Section 1: Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. ORDER SUMMARY</Text>
          <KV label="Order Number" value={order.orderNumber} />
          <KV label="Order ID" value={order.id} />
          <KV label="Status" value={order.status.toUpperCase()} />
          <KV label="Created" value={fmtDate(order.createdAt)} />
          <KV label="Product" value={order.product.name} />
          <KV label="Product Slug" value={order.product.slug} />
          <KV label="Category" value={order.product.category} />
          <KV
            label="Amount"
            value={`$${String(order.amountUsd)} ${order.currency}`}
          />
          <KV label="Buyer Name" value={order.buyerName || "N/A"} />
          <KV label="Buyer Email" value={order.buyerEmail} />
          <KV label="Buyer IP (masked)" value={order.buyerIp || "N/A"} />
          <KV label="Buyer Country" value={order.buyerCountry || "N/A"} />
          <KV label="Buyer City" value={order.buyerCity || "N/A"} />
        </View>

        {/* Section 2: Identity Verification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. IDENTITY VERIFICATION</Text>
          <KV label="Name at Checkout" value={order.buyerName || "N/A"} />
          <KV label="PayPal Payer Name" value={order.paypalPayerName || "N/A"} />
          <KV label="Email at Checkout" value={order.buyerEmail} />
          <KV label="PayPal Payer Email" value={order.paypalPayerEmail || "N/A"} />
          {(() => {
            const checkoutName = (order.buyerName || "").trim().toLowerCase();
            const paypalName = (order.paypalPayerName || "").trim().toLowerCase();
            const nameMatch = checkoutName && paypalName
              ? checkoutName === paypalName
                ? "EXACT MATCH"
                : paypalName.includes(checkoutName) || checkoutName.includes(paypalName)
                  ? "PARTIAL MATCH"
                  : "MISMATCH"
              : "PENDING";
            return (
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                <Text style={nameMatch === "EXACT MATCH" ? styles.badgeValid : nameMatch === "PARTIAL MATCH" ? styles.badgeValid : nameMatch === "MISMATCH" ? styles.badgeBroken : { fontSize: 8, color: colors.textMuted }}>
                  NAME MATCH: {nameMatch}
                </Text>
              </View>
            );
          })()}
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              The buyer entered their full name at checkout before payment. This name can be compared against the PayPal account holder name to verify the transaction was authorized by the account owner.
            </Text>
          </View>
        </View>

        {/* Section 3: Payment Proof */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. PAYMENT PROOF (PayPal)</Text>
          <KV
            label="PayPal Order ID"
            value={order.paypalOrderId || "N/A"}
          />
          <KV
            label="PayPal Capture ID"
            value={order.paypalCaptureId || "N/A"}
          />
          <KV
            label="PayPal Payer ID"
            value={order.paypalPayerId || "N/A"}
          />
          <KV
            label="PayPal Payer Name"
            value={order.paypalPayerName || "N/A"}
          />
          <KV
            label="PayPal Payer Email"
            value={order.paypalPayerEmail || "N/A"}
          />
          <KV
            label="PayPal Status"
            value={order.paypalStatus || "N/A"}
          />
          <KV
            label="Webhook Received"
            value={fmtDate(order.paypalWebhookReceivedAt)}
          />
        </View>

        {/* Section 4: Terms Acceptance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            4. TERMS OF SERVICE ACCEPTANCE
          </Text>
          <KV
            label="Terms Version"
            value={order.termsVersion.versionLabel}
          />
          <KV
            label="Content Hash"
            value={order.termsVersion.contentHash}
          />
          <KV label="Accepted At" value={fmtDate(order.termsAcceptedAt)} />
          <KV
            label="Accepted IP"
            value={order.termsAcceptedIp || "N/A"}
          />
          <KV
            label="Accepted UA"
            value={truncate(order.termsAcceptedUa || "N/A", 100)}
          />
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Terms content (first 400 chars):{"\n"}
              {truncate(order.termsVersion.content, 400)}
            </Text>
          </View>
        </View>

        {/* Section 5: License */}
        {order.license && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. LICENSE INFORMATION</Text>
            <KV label="License Key" value={order.license.licenseKey} />
            <KV label="Fingerprint" value={order.license.fingerprint} />
            <KV label="Status" value={order.license.status} />
            <KV label="Created" value={fmtDate(order.license.createdAt)} />
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {storeName} Forensic Engine — {documentId}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* ── PAGE 2: Downloads + Delivery + Emails ── */}
      <Page size="A4" style={styles.page}>
        {/* Section 6: Download History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. DOWNLOAD HISTORY</Text>
          <KV
            label="Total Downloads"
            value={`${order.downloadCount} / ${order.downloadLimit}`}
          />
          <KV
            label="Downloads Expire"
            value={fmtDate(order.downloadsExpireAt)}
          />
          <KV
            label="Downloads Revoked"
            value={order.downloadsRevoked ? "YES" : "NO"}
          />

          {downloadEvents.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: 130 }]}>
                  Timestamp
                </Text>
                <Text style={[styles.tableHeaderCell, { width: 140 }]}>
                  Event
                </Text>
                <Text style={[styles.tableHeaderCell, { width: 80 }]}>
                  IP
                </Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>
                  Result
                </Text>
              </View>
              {downloadEvents.map((ev, i) => {
                const data = ev.eventData as Record<string, unknown>;
                return (
                  <View
                    key={i}
                    style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                  >
                    <Text style={[styles.tableCell, { width: 130 }]}>
                      {fmtDate(ev.createdAt)}
                    </Text>
                    <Text style={[styles.tableCell, { width: 140 }]}>
                      {ev.eventType}
                    </Text>
                    <Text style={[styles.tableCell, { width: 80 }]}>
                      {ev.ipAddress || "N/A"}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>
                      {String(data.result || data.filename || "—")}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Section 7: Delivery Stages */}
        {order.deliveryStages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. DELIVERY STAGES</Text>
            {order.deliveryStages.map((stage, i) => (
              <View
                key={i}
                style={{
                  marginBottom: 4,
                  paddingLeft: 8,
                  borderLeftWidth: 2,
                  borderLeftColor:
                    stage.status === "delivered"
                      ? colors.success
                      : stage.status === "revoked"
                        ? colors.danger
                        : colors.accent,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Helvetica-Bold",
                    fontSize: 8,
                  }}
                >
                  Stage {stage.stageOrder} ({stage.stageType}) — {stage.status}
                </Text>
                <Text style={{ fontSize: 7, color: colors.textSecondary }}>
                  File: {stage.filename || "N/A"} | SHA256:{" "}
                  {truncate(stage.sha256Hash || "N/A", 20)} | Downloads:{" "}
                  {stage.downloadCount}/{stage.downloadLimit} | Released:{" "}
                  {fmtDate(stage.releasedAt)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Section 8: Proof of Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            8. PROOF OF ACCESS (My Downloads)
          </Text>
          {accessEvents.length > 0 ? (
            accessEvents.map((ev, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.label}>{fmtDate(ev.createdAt)}</Text>
                <Text style={styles.value}>
                  Viewed "My Downloads" — IP: {ev.ipAddress || "N/A"}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 8, color: colors.textMuted }}>
              No access page views recorded.
            </Text>
          )}
        </View>

        {/* Section 9: Email Delivery Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. EMAIL DELIVERY LOG</Text>
          {emailEvents.length > 0 ? (
            emailEvents.map((ev, i) => {
              const data = ev.eventData as Record<string, unknown>;
              return (
                <View key={i} style={styles.row}>
                  <Text style={styles.label}>{fmtDate(ev.createdAt)}</Text>
                  <Text style={styles.value}>
                    {ev.eventType} → {String(data.to || "N/A")} (
                    {String(data.messageId || "N/A")})
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={{ fontSize: 8, color: colors.textMuted }}>
              No email events recorded.
            </Text>
          )}
        </View>

        {/* Section 10: Admin Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. ADMIN ACTIONS LOG</Text>
          {adminEvents.length > 0 ? (
            adminEvents.map((ev, i) => {
              const data = ev.eventData as Record<string, unknown>;
              return (
                <View key={i} style={styles.chainBlock}>
                  <Text style={styles.chainSeq}>
                    [{fmtDate(ev.createdAt)}] {ev.eventType}
                  </Text>
                  {Object.entries(data).map(([k, v]) => (
                    <Text key={k} style={styles.chainDetail}>
                      {k}: {String(v)}
                    </Text>
                  ))}
                </View>
              );
            })
          ) : (
            <Text style={{ fontSize: 8, color: colors.textMuted }}>
              No admin actions recorded.
            </Text>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {storeName} Forensic Engine — {documentId}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* ── PAGE 3: Snapshots + Chain ── */}
      <Page size="A4" style={styles.page}>
        {/* Section 11: Forensic Snapshots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            11. FORENSIC PRODUCT SNAPSHOTS
          </Text>
          {order.snapshots.length > 0 ? (
            order.snapshots.map((snap, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.label}>
                  {snap.snapshotType.toUpperCase()} —{" "}
                  {fmtDate(snap.createdAt)}
                </Text>
                <Text style={styles.value}>
                  Hash: {snap.snapshotHash}
                  {snap.snapshotHtmlKey
                    ? ` | HTML: ${snap.snapshotHtmlKey}`
                    : ""}
                  {snap.snapshotPdfKey
                    ? ` | PDF: ${snap.snapshotPdfKey}`
                    : ""}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 8, color: colors.textMuted }}>
              No snapshots recorded.
            </Text>
          )}
        </View>

        {/* Section 12: Chain Integrity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            12. TAMPER-EVIDENT EVENT CHAIN
          </Text>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text
              style={chain.valid ? styles.badgeValid : styles.badgeBroken}
            >
              {chain.valid ? "CHAIN VALID" : "CHAIN BROKEN"}
            </Text>
          </View>
          <KV label="Total Events" value={String(chain.totalEvents)} />
          <KV label="First Event" value={fmtDate(chain.firstEventAt)} />
          <KV label="Last Event" value={fmtDate(chain.lastEventAt)} />
          {!chain.valid && chain.brokenAtSequence && (
            <KV
              label="Broken at Seq"
              value={`#${chain.brokenAtSequence}`}
            />
          )}
        </View>

        {/* Full chain listing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COMPLETE EVENT CHAIN</Text>
          {order.events.map((ev, i) => (
            <View key={i} style={styles.chainBlock}>
              <Text style={styles.chainSeq}>
                #{ev.sequenceNumber} {ev.eventType}
              </Text>
              <Text style={styles.chainDetail}>
                Time: {fmtDate(ev.createdAt)}
                {ev.ipAddress ? ` | IP: ${ev.ipAddress}` : ""}
                {ev.externalRef ? ` | Ref: ${ev.externalRef}` : ""}
              </Text>
              <Text style={styles.chainHash}>
                Hash: {ev.eventHash}
              </Text>
              <Text style={styles.chainHash}>
                Prev: {ev.prevHash || "GENESIS"}
              </Text>
            </View>
          ))}
        </View>

        {/* Dispute Mode Status */}
        {order.evidenceFrozenAt && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>13. DISPUTE MODE STATUS</Text>
            <View style={styles.frozenBox}>
              <Text style={styles.frozenText}>EVIDENCE FROZEN</Text>
            </View>
            <KV
              label="Frozen At"
              value={fmtDate(order.evidenceFrozenAt)}
            />
            <KV
              label="Frozen By"
              value={order.evidenceFrozenByAdmin || "N/A"}
            />
            <KV
              label="Retention Until"
              value={fmtDate(order.retentionExpiresAt)}
            />
          </View>
        )}

        {/* End */}
        <View
          style={{
            marginTop: 12,
            backgroundColor: colors.primary,
            padding: 12,
            borderRadius: 4,
          }}
        >
          <Text
            style={{
              color: "#ffffff",
              fontSize: 8,
              textAlign: "center",
              fontFamily: "Helvetica-Bold",
            }}
          >
            END OF EVIDENCE PACK
          </Text>
          <Text
            style={{
              color: "#cbd5e1",
              fontSize: 7,
              textAlign: "center",
              marginTop: 2,
            }}
          >
            Auto-generated by {storeName} Forensic Engine. All events are
            cryptographically chained (SHA-256) and tamper-evident. Chain
            integrity:{" "}
            {chain.valid ? "VERIFIED" : "COMPROMISED"}
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {storeName} Forensic Engine — {documentId}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

// ── Public API ───────────────────────────────────────
export async function generateEvidencePdf(
  order: EvidenceOrderData,
  chain: ChainResult,
  generatedBy: string,
  storeName?: string
): Promise<{ buffer: Buffer; filename: string; documentId: string }> {
  const now = new Date();
  const documentId = `EVD-${order.orderNumber}-${Date.now()}`;
  const filename = `evidence-${order.orderNumber}-${now.toISOString().split("T")[0]}.pdf`;

  const buffer = await renderToBuffer(
    <EvidenceDocument
      order={order}
      chain={chain}
      generatedBy={generatedBy}
      generatedAt={now}
      documentId={documentId}
      storeName={storeName || "TiendaDigital"}
    />
  );

  return {
    buffer: Buffer.from(buffer),
    filename,
    documentId,
  };
}
