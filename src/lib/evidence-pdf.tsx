import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";

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

// ── Helpers ──────────────────────────────────────────
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "N/A";
  return new Date(d).toISOString();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max) + "..." : s;
}

// ── Colors (as RGB 0-1) ─────────────────────────────
const C = {
  primary: rgb(0.118, 0.161, 0.231),
  accent: rgb(0.145, 0.388, 0.922),
  success: rgb(0.02, 0.588, 0.412),
  danger: rgb(0.863, 0.149, 0.149),
  warning: rgb(0.851, 0.467, 0.024),
  white: rgb(1, 1, 1),
  textSec: rgb(0.392, 0.455, 0.545),
  textMut: rgb(0.58, 0.639, 0.722),
  border: rgb(0.886, 0.91, 0.941),
  bgAlt: rgb(0.973, 0.98, 0.988),
  warningBg: rgb(0.996, 0.953, 0.78),
  dangerBg: rgb(0.996, 0.949, 0.949),
  successBg: rgb(0.863, 0.988, 0.906),
};

// ── PDF Writer class ─────────────────────────────────
class PdfWriter {
  doc!: PDFDocument;
  page!: PDFPage;
  font!: PDFFont;
  fontBold!: PDFFont;
  fontMono!: PDFFont;
  y = 0;
  pageNum = 0;
  totalPages = 0;
  readonly margin = 40;
  readonly pageW = 595.28; // A4
  readonly pageH = 841.89;
  readonly contentW: number;
  readonly footerY = 30;

  constructor() {
    this.contentW = this.pageW - this.margin * 2;
  }

  async init() {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.fontMono = await this.doc.embedFont(StandardFonts.Courier);
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([this.pageW, this.pageH]);
    this.y = this.pageH - this.margin;
    this.pageNum++;
  }

  ensureSpace(needed: number) {
    if (this.y - needed < this.footerY + 20) {
      this.drawFooter();
      this.newPage();
    }
  }

  // ── Drawing primitives ──
  text(
    str: string,
    x: number,
    size: number,
    options?: { font?: PDFFont; color?: ReturnType<typeof rgb>; maxWidth?: number }
  ) {
    const f = options?.font || this.font;
    const c = options?.color || C.primary;
    const maxW = options?.maxWidth || this.contentW;
    // Truncate if too wide
    let s = str;
    while (s.length > 1 && f.widthOfTextAtSize(s, size) > maxW) {
      s = s.substring(0, s.length - 2) + "…";
    }
    // Sanitize: replace characters outside WinAnsi with '?'
    s = s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
    this.page.drawText(s, { x: this.margin + x, y: this.y, size, font: f, color: c });
  }

  rect(x: number, w: number, h: number, color: ReturnType<typeof rgb>) {
    this.page.drawRectangle({
      x: this.margin + x,
      y: this.y - h + 12,
      width: w,
      height: h,
      color,
    });
  }

  line(x1: number, x2: number, color: ReturnType<typeof rgb> = C.border) {
    this.page.drawLine({
      start: { x: this.margin + x1, y: this.y },
      end: { x: this.margin + x2, y: this.y },
      thickness: 1,
      color,
    });
  }

  // ── Compound elements ──
  header(title: string, subtitle: string) {
    const h = 50;
    this.rect(0, this.contentW, h, C.primary);
    this.y -= 8;
    const tw = this.fontBold.widthOfTextAtSize(title, 14);
    this.page.drawText(title, {
      x: this.margin + (this.contentW - tw) / 2,
      y: this.y,
      size: 14,
      font: this.fontBold,
      color: C.white,
    });
    this.y -= 14;
    const sw = this.font.widthOfTextAtSize(subtitle, 8);
    this.page.drawText(subtitle.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?"), {
      x: this.margin + (this.contentW - sw) / 2,
      y: this.y,
      size: 8,
      font: this.font,
      color: rgb(0.796, 0.835, 0.882),
    });
    this.y -= h - 16;
  }

  sectionTitle(title: string) {
    this.ensureSpace(24);
    this.y -= 6;
    this.text(title, 0, 10, { font: this.fontBold });
    this.y -= 4;
    this.line(0, this.contentW, C.accent);
    this.y -= 10;
  }

  kv(label: string, value: string) {
    this.ensureSpace(14);
    this.text(label, 0, 8, { font: this.fontBold, color: C.textSec, maxWidth: 130 });
    this.text(value, 140, 8, { maxWidth: this.contentW - 140 });
    this.y -= 12;
  }

  note(txt: string, bgColor: ReturnType<typeof rgb>, textColor: ReturnType<typeof rgb>, borderColor: ReturnType<typeof rgb>) {
    const lines = this.wrapText(txt, 7, this.contentW - 20);
    const h = lines.length * 10 + 10;
    this.ensureSpace(h + 4);
    this.rect(0, this.contentW, h, bgColor);
    // left border
    this.page.drawRectangle({
      x: this.margin,
      y: this.y - h + 12,
      width: 3,
      height: h,
      color: borderColor,
    });
    this.y -= 4;
    for (const l of lines) {
      this.text(l, 8, 7, { color: textColor });
      this.y -= 10;
    }
    this.y -= 6;
  }

  badge(label: string, valid: boolean) {
    const bgC = valid ? C.successBg : C.dangerBg;
    const fgC = valid ? C.success : C.danger;
    const w = this.fontBold.widthOfTextAtSize(label, 8) + 12;
    this.ensureSpace(16);
    this.rect(0, w, 14, bgC);
    this.text(label, 4, 8, { font: this.fontBold, color: fgC });
    this.y -= 18;
  }

  chainEvent(seq: number, type: string, time: string, ip: string, ref: string, hash: string, prev: string) {
    const needed = 46;
    this.ensureSpace(needed);
    // left accent bar
    this.page.drawRectangle({
      x: this.margin,
      y: this.y - needed + 12,
      width: 2,
      height: needed,
      color: C.accent,
    });
    this.text(`#${seq} ${type}`, 6, 8, { font: this.fontBold, color: C.accent });
    this.y -= 10;
    this.text(`Time: ${time}${ip ? ` | IP: ${ip}` : ""}${ref ? ` | Ref: ${ref}` : ""}`, 6, 7, { color: C.textSec });
    this.y -= 9;
    this.text(`Hash: ${hash}`, 6, 6, { font: this.fontMono, color: C.textMut });
    this.y -= 8;
    this.text(`Prev: ${prev}`, 6, 6, { font: this.fontMono, color: C.textMut });
    this.y -= 12;
  }

  drawFooter(footerLeft?: string) {
    const txt = footerLeft || "";
    if (txt) {
      this.page.drawText(txt.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?"), {
        x: this.margin,
        y: this.footerY,
        size: 7,
        font: this.font,
        color: C.textMut,
      });
    }
  }

  addFooters(footerLeft: string) {
    const pages = this.doc.getPages();
    this.totalPages = pages.length;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      // separator line
      p.drawLine({
        start: { x: this.margin, y: this.footerY + 10 },
        end: { x: this.pageW - this.margin, y: this.footerY + 10 },
        thickness: 0.5,
        color: C.border,
      });
      p.drawText(footerLeft.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?"), {
        x: this.margin,
        y: this.footerY,
        size: 7,
        font: this.font,
        color: C.textMut,
      });
      const pageLabel = `Page ${i + 1} / ${pages.length}`;
      const pw = this.font.widthOfTextAtSize(pageLabel, 7);
      p.drawText(pageLabel, {
        x: this.pageW - this.margin - pw,
        y: this.footerY,
        size: 7,
        font: this.font,
        color: C.textMut,
      });
    }
  }

  wrapText(txt: string, size: number, maxW: number): string[] {
    const words = txt.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const test = current ? current + " " + w : w;
      if (this.font.widthOfTextAtSize(test, size) > maxW && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
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
  const store = storeName || "TiendaDigital";

  const w = new PdfWriter();
  await w.init();

  // ── Header ──
  w.header("EVIDENCE PACK - CHARGEBACK DEFENSE", `Document ${documentId} | Generated ${fmtDate(now)} by ${generatedBy}`);

  // Dispute freeze banner
  if (order.evidenceFrozenAt) {
    w.note(
      `DISPUTE MODE ACTIVE - Evidence frozen at ${fmtDate(order.evidenceFrozenAt)} by ${order.evidenceFrozenByAdmin || "N/A"}`,
      C.dangerBg, C.danger, C.danger
    );
  }

  // ── 1. Order Summary ──
  w.sectionTitle("1. ORDER SUMMARY");
  w.kv("Order Number", order.orderNumber);
  w.kv("Order ID", order.id);
  w.kv("Status", order.status.toUpperCase());
  w.kv("Created", fmtDate(order.createdAt));
  w.kv("Product", order.product.name);
  w.kv("Product Slug", order.product.slug);
  w.kv("Category", order.product.category);
  w.kv("Amount", `$${String(order.amountUsd)} ${order.currency}`);
  w.kv("Buyer Name", order.buyerName || "N/A");
  w.kv("Buyer Email", order.buyerEmail);
  w.kv("Buyer IP (masked)", order.buyerIp || "N/A");
  w.kv("Buyer Country", order.buyerCountry || "N/A");
  w.kv("Buyer City", order.buyerCity || "N/A");

  // ── 2. Identity Verification ──
  w.sectionTitle("2. IDENTITY VERIFICATION");
  w.kv("Name at Checkout", order.buyerName || "N/A");
  w.kv("PayPal Payer Name", order.paypalPayerName || "N/A");
  w.kv("Email at Checkout", order.buyerEmail);
  w.kv("PayPal Payer Email", order.paypalPayerEmail || "N/A");
  const cName = (order.buyerName || "").trim().toLowerCase();
  const pName = (order.paypalPayerName || "").trim().toLowerCase();
  const nameMatch = cName && pName
    ? cName === pName ? "EXACT MATCH" : (pName.includes(cName) || cName.includes(pName)) ? "PARTIAL MATCH" : "MISMATCH"
    : "PENDING";
  w.badge(`NAME MATCH: ${nameMatch}`, nameMatch !== "MISMATCH");
  w.note(
    "The buyer entered their full name at checkout before payment. This name can be compared against the PayPal account holder name to verify the transaction was authorized by the account owner.",
    C.warningBg, rgb(0.573, 0.251, 0.055), C.warning
  );

  // ── 3. Payment Proof ──
  w.sectionTitle("3. PAYMENT PROOF (PayPal)");
  w.kv("PayPal Order ID", order.paypalOrderId || "N/A");
  w.kv("PayPal Capture ID", order.paypalCaptureId || "N/A");
  w.kv("PayPal Payer ID", order.paypalPayerId || "N/A");
  w.kv("PayPal Payer Name", order.paypalPayerName || "N/A");
  w.kv("PayPal Payer Email", order.paypalPayerEmail || "N/A");
  w.kv("PayPal Status", order.paypalStatus || "N/A");
  w.kv("Webhook Received", fmtDate(order.paypalWebhookReceivedAt));

  // ── 4. Terms Acceptance ──
  w.sectionTitle("4. TERMS OF SERVICE ACCEPTANCE");
  w.kv("Terms Version", order.termsVersion.versionLabel);
  w.kv("Content Hash", order.termsVersion.contentHash);
  w.kv("Accepted At", fmtDate(order.termsAcceptedAt));
  w.kv("Accepted IP", order.termsAcceptedIp || "N/A");
  w.kv("Accepted UA", truncate(order.termsAcceptedUa || "N/A", 100));
  w.note(
    `Terms content (first 400 chars): ${truncate(order.termsVersion.content, 400)}`,
    C.warningBg, rgb(0.573, 0.251, 0.055), C.warning
  );

  // ── 5. License ──
  if (order.license) {
    w.sectionTitle("5. LICENSE INFORMATION");
    w.kv("License Key", order.license.licenseKey);
    w.kv("Fingerprint", order.license.fingerprint);
    w.kv("Status", order.license.status);
    w.kv("Created", fmtDate(order.license.createdAt));
  }

  // ── 6. Download History ──
  w.sectionTitle("6. DOWNLOAD HISTORY");
  w.kv("Total Downloads", `${order.downloadCount} / ${order.downloadLimit}`);
  w.kv("Downloads Expire", fmtDate(order.downloadsExpireAt));
  w.kv("Downloads Revoked", order.downloadsRevoked ? "YES" : "NO");
  const dlEvents = order.events.filter((e) => e.eventType.startsWith("download."));
  for (const ev of dlEvents) {
    const data = ev.eventData as Record<string, unknown>;
    w.ensureSpace(14);
    w.text(`${fmtDate(ev.createdAt)}  ${ev.eventType}  IP: ${ev.ipAddress || "N/A"}  ${String(data.result || data.filename || "-")}`, 0, 7, { color: C.textSec });
    w.y -= 10;
  }

  // ── 7. Delivery Stages ──
  if (order.deliveryStages.length > 0) {
    w.sectionTitle("7. DELIVERY STAGES");
    for (const stage of order.deliveryStages) {
      w.ensureSpace(24);
      w.text(`Stage ${stage.stageOrder} (${stage.stageType}) - ${stage.status}`, 0, 8, { font: w.fontBold });
      w.y -= 10;
      w.text(`File: ${stage.filename || "N/A"} | SHA256: ${truncate(stage.sha256Hash || "N/A", 20)} | Downloads: ${stage.downloadCount}/${stage.downloadLimit} | Released: ${fmtDate(stage.releasedAt)}`, 0, 7, { color: C.textSec });
      w.y -= 12;
    }
  }

  // ── 8. Proof of Access ──
  w.sectionTitle("8. PROOF OF ACCESS (My Downloads)");
  const accessEvents = order.events.filter((e) => e.eventType === "download.access_page_viewed");
  if (accessEvents.length > 0) {
    for (const ev of accessEvents) {
      w.kv(fmtDate(ev.createdAt), `Viewed "My Downloads" - IP: ${ev.ipAddress || "N/A"}`);
    }
  } else {
    w.text("No access page views recorded.", 0, 8, { color: C.textMut });
    w.y -= 12;
  }

  // ── 9. Email Delivery Log ──
  w.sectionTitle("9. EMAIL DELIVERY LOG");
  const emailEvents = order.events.filter((e) => e.eventType.startsWith("email."));
  if (emailEvents.length > 0) {
    for (const ev of emailEvents) {
      const data = ev.eventData as Record<string, unknown>;
      w.kv(fmtDate(ev.createdAt), `${ev.eventType} -> ${String(data.to || "N/A")} (${String(data.messageId || "N/A")})`);
    }
  } else {
    w.text("No email events recorded.", 0, 8, { color: C.textMut });
    w.y -= 12;
  }

  // ── 10. Admin Actions ──
  w.sectionTitle("10. ADMIN ACTIONS LOG");
  const adminEvents = order.events.filter((e) => e.eventType.startsWith("admin."));
  if (adminEvents.length > 0) {
    for (const ev of adminEvents) {
      const data = ev.eventData as Record<string, unknown>;
      w.ensureSpace(20);
      w.text(`[${fmtDate(ev.createdAt)}] ${ev.eventType}`, 0, 8, { font: w.fontBold, color: C.accent });
      w.y -= 10;
      for (const [k, v] of Object.entries(data)) {
        w.text(`${k}: ${String(v)}`, 6, 7, { color: C.textSec });
        w.y -= 9;
      }
      w.y -= 4;
    }
  } else {
    w.text("No admin actions recorded.", 0, 8, { color: C.textMut });
    w.y -= 12;
  }

  // ── 11. Forensic Snapshots ──
  w.sectionTitle("11. FORENSIC PRODUCT SNAPSHOTS");
  if (order.snapshots.length > 0) {
    for (const snap of order.snapshots) {
      w.kv(
        `${snap.snapshotType.toUpperCase()} - ${fmtDate(snap.createdAt)}`,
        `Hash: ${snap.snapshotHash}${snap.snapshotHtmlKey ? ` | HTML: ${snap.snapshotHtmlKey}` : ""}${snap.snapshotPdfKey ? ` | PDF: ${snap.snapshotPdfKey}` : ""}`
      );
    }
  } else {
    w.text("No snapshots recorded.", 0, 8, { color: C.textMut });
    w.y -= 12;
  }

  // ── 12. Chain Integrity ──
  w.sectionTitle("12. TAMPER-EVIDENT EVENT CHAIN");
  w.badge(chain.valid ? "CHAIN VALID" : "CHAIN BROKEN", chain.valid);
  w.kv("Total Events", String(chain.totalEvents));
  w.kv("First Event", fmtDate(chain.firstEventAt));
  w.kv("Last Event", fmtDate(chain.lastEventAt));
  if (!chain.valid && chain.brokenAtSequence) {
    w.kv("Broken at Seq", `#${chain.brokenAtSequence}`);
  }

  // Complete event chain
  w.sectionTitle("COMPLETE EVENT CHAIN");
  for (const ev of order.events) {
    w.chainEvent(
      ev.sequenceNumber,
      ev.eventType,
      fmtDate(ev.createdAt),
      ev.ipAddress || "",
      ev.externalRef || "",
      ev.eventHash,
      ev.prevHash || "GENESIS"
    );
  }

  // ── 13. Dispute Mode ──
  if (order.evidenceFrozenAt) {
    w.sectionTitle("13. DISPUTE MODE STATUS");
    w.note("EVIDENCE FROZEN", C.dangerBg, C.danger, C.danger);
    w.kv("Frozen At", fmtDate(order.evidenceFrozenAt));
    w.kv("Frozen By", order.evidenceFrozenByAdmin || "N/A");
    w.kv("Retention Until", fmtDate(order.retentionExpiresAt));
  }

  // ── End banner ──
  w.ensureSpace(40);
  w.rect(0, w.contentW, 36, C.primary);
  w.y -= 6;
  const endTitle = "END OF EVIDENCE PACK";
  const etw = w.fontBold.widthOfTextAtSize(endTitle, 8);
  w.page.drawText(endTitle, { x: w.margin + (w.contentW - etw) / 2, y: w.y, size: 8, font: w.fontBold, color: C.white });
  w.y -= 12;
  const endSub = `Auto-generated by ${store} Forensic Engine. Chain integrity: ${chain.valid ? "VERIFIED" : "COMPROMISED"}`;
  const endSubSafe = endSub.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  const esw = w.font.widthOfTextAtSize(endSubSafe, 7);
  w.page.drawText(endSubSafe, { x: w.margin + (w.contentW - esw) / 2, y: w.y, size: 7, font: w.font, color: rgb(0.796, 0.835, 0.882) });
  w.y -= 20;

  // ── Footers on all pages ──
  w.addFooters(`${store} Forensic Engine - ${documentId}`);

  const pdfBytes = await w.save();

  return {
    buffer: Buffer.from(pdfBytes),
    filename,
    documentId,
  };
}
