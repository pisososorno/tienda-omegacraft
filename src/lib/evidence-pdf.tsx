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
  buyerUserAgent: string | null;
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
  paypalRawCapture: unknown | null;
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
  productSnapshot: unknown;
  product: {
    name: string;
    slug: string;
    category: string;
    shortDescription: string | null;
    metadata: unknown;
    priceUsd: unknown;
    files: Array<{
      filename: string;
      fileSize: bigint | number;
      sha256Hash: string;
      mimeType: string;
    }>;
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
    fileSize: bigint | number | null;
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

// ── Helpers for PDF generation ───────────────────────
function fmtSize(bytes: number | bigint | null | undefined): string {
  if (bytes === null || bytes === undefined) return "N/A";
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "N/A";
  return String(v);
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

  // Precompute event categories
  const dlCompletedEvents = order.events.filter((e) => e.eventType === "download.completed");
  const tokenEvents = order.events.filter((e) => e.eventType === "download.token_generated");
  const webActivityEvents = order.events.filter((e) =>
    ["checkout.success_viewed", "downloads.page_viewed", "download.button_clicked", "download.link_opened", "download.access_page_viewed", "download.completed"].includes(e.eventType)
  );
  const emailEvents = order.events.filter((e) => e.eventType.startsWith("email."));
  const adminEvents = order.events.filter((e) => e.eventType.startsWith("admin."));
  const paymentCapturedEvent = order.events.find((e) => e.eventType === "payment.captured");
  const paymentRecordedEvent = order.events.find((e) => e.eventType === "payment.recorded");
  const redeemCompletedEvent = order.events.find((e) => e.eventType === "redeem.completed");
  const orderCreatedEvent = order.events.find((e) => e.eventType === "order.created");
  const isManualSale = !!(paymentRecordedEvent || (orderCreatedEvent && (orderCreatedEvent.eventData as Record<string, unknown>)?.source === "manual_sale"));
  const manualPaymentData = paymentRecordedEvent ? paymentRecordedEvent.eventData as Record<string, unknown> : null;

  // ── Header ──
  w.header("EVIDENCE PACK - CHARGEBACK DEFENSE", `Document ${documentId} | Generated ${fmtDate(now)} by ${generatedBy}`);

  // Dispute freeze banner
  if (order.evidenceFrozenAt) {
    w.note(
      `DISPUTE MODE ACTIVE - Evidence frozen at ${fmtDate(order.evidenceFrozenAt)} by ${order.evidenceFrozenByAdmin || "N/A"}`,
      C.dangerBg, C.danger, C.danger
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DISPUTE RESPONSE SUMMARY (dynamic paragraph)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    w.sectionTitle("DISPUTE RESPONSE SUMMARY");
    const deliveryDone = dlCompletedEvents.length > 0;
    const ppStatus = (order.paypalStatus || "N/A").toUpperCase();
    const tosVer = order.termsVersion.versionLabel;
    const tosHash = truncate(order.termsVersion.contentHash, 12);

    // IP/UA correlation
    let correlationText = "Session correlation data is not yet available (no downloads recorded).";
    if (deliveryDone) {
      const chkIp = order.buyerIp || "";
      const dlIp = dlCompletedEvents[0].ipAddress || "";
      const chkUa = order.buyerUserAgent || "";
      const dlUa = dlCompletedEvents[0].userAgent || "";
      const ipOk = chkIp && dlIp && chkIp === dlIp;
      const uaOk = chkUa && dlUa && chkUa === dlUa;
      if (ipOk && uaOk) {
        correlationText = "Session correlation shows IP and User-Agent MATCH between purchase and download.";
      } else if (ipOk) {
        correlationText = "Session correlation shows IP MATCH between purchase and download (User-Agent differs).";
      } else if (uaOk) {
        correlationText = "Session correlation shows User-Agent MATCH between purchase and download (IP differs).";
      } else {
        correlationText = "Session correlation shows IP and User-Agent DIFFER between purchase and download.";
      }
    }

    let paymentSummary: string;
    if (isManualSale) {
      const method = manualPaymentData?.method ? String(manualPaymentData.method) : "manual";
      const ref = manualPaymentData?.paymentRef ? ` (ref: ${String(manualPaymentData.paymentRef)})` : "";
      paymentSummary = `Payment was recorded via ${method === "paypal_invoice" ? "PayPal Invoice" : "manual payment"}${ref}.`;
    } else {
      paymentSummary = `Payment was completed via PayPal (status: ${ppStatus}).`;
    }

    const summary = `${paymentSummary} ` +
      `The buyer accepted the Terms of Service (${tosVer}, hash ${tosHash}...) before payment. ` +
      `Digital delivery was ${deliveryDone ? "completed" : "NOT completed"} via secure download token and license issuance` +
      `${deliveryDone ? ", and the file was successfully downloaded (download.completed)" : ""}. ` +
      correlationText;

    w.note(summary, C.warningBg, rgb(0.573, 0.251, 0.055), C.warning);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 1: ORDER SUMMARY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("1. ORDER SUMMARY");
  w.kv("Order Number", order.orderNumber);
  w.kv("Order ID", order.id);
  w.kv("Status", order.status.toUpperCase());
  w.kv("Created", fmtDate(order.createdAt));
  w.kv("Product", order.product.name);
  w.kv("Category", order.product.category);
  w.kv("Amount", `$${String(order.amountUsd)} ${order.currency}`);
  w.kv("Buyer Name", order.buyerName || "N/A");
  w.kv("Buyer Email", order.buyerEmail);
  w.kv("Buyer IP (masked)", order.buyerIp || "N/A");
  w.kv("Buyer Country", order.buyerCountry || "N/A");
  w.kv("Buyer City", order.buyerCity || "N/A");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION A: DIGITAL DELIVERY DETAILS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("2. DIGITAL DELIVERY DETAILS");
  w.kv("Product Type", "Digital download (intangible)");
  w.kv("Delivery Method", "Instant download via secure token + license key");
  const deliveryCompleted = dlCompletedEvents.length > 0;
  w.kv("Delivery Completed", deliveryCompleted ? "YES" : "NO");
  if (deliveryCompleted) {
    w.kv("First Download At", fmtDate(dlCompletedEvents[0].createdAt));
  }
  if (tokenEvents.length > 0) {
    w.kv("Delivery Token Created", fmtDate(tokenEvents[0].createdAt));
  }
  w.kv("Delivery Revocable", "YES");
  w.kv("Downloads Revoked", order.downloadsRevoked ? "YES" : "NO");
  if (order.license) {
    w.kv("License Status", order.license.status.toUpperCase());
  }
  w.note(
    "This is a digital product delivered instantly after payment via secure download token. The buyer was granted time-limited, count-limited download access.",
    C.warningBg, rgb(0.573, 0.251, 0.055), C.warning
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 2: IDENTITY VERIFICATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("3. IDENTITY VERIFICATION");
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION D: SESSION CORRELATION (PURCHASE vs DOWNLOAD)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("4. SESSION CORRELATION (Purchase vs Download)");
  const checkoutIp = order.buyerIp || "";
  const checkoutUa = order.buyerUserAgent || "";
  const checkoutCountry = order.buyerCountry || "";
  const checkoutCity = order.buyerCity || "";

  if (dlCompletedEvents.length > 0) {
    const firstDl = dlCompletedEvents[0];
    const dlIp = firstDl.ipAddress || "";
    const dlUa = firstDl.userAgent || "";

    const ipMatch = checkoutIp && dlIp ? (checkoutIp === dlIp ? "MATCH" : "DIFFERENT") : "UNKNOWN";
    const uaMatch = checkoutUa && dlUa ? (checkoutUa === dlUa ? "MATCH" : "DIFFERENT") : "UNKNOWN";

    w.kv("Checkout IP", checkoutIp || "N/A");
    w.kv("Download IP", dlIp || "N/A");
    w.badge(`IP CORRELATION: ${ipMatch}`, ipMatch === "MATCH");

    w.kv("Checkout UA", truncate(checkoutUa || "N/A", 80));
    w.kv("Download UA", truncate(dlUa || "N/A", 80));
    w.badge(`USER-AGENT CORRELATION: ${uaMatch}`, uaMatch === "MATCH");

    if (checkoutCountry) {
      w.kv("Checkout Location", `${checkoutCountry}${checkoutCity ? `, ${checkoutCity}` : ""}`);
    }

    // Time delta
    if (paymentCapturedEvent) {
      const captureTime = new Date(paymentCapturedEvent.createdAt).getTime();
      const dlTime = new Date(firstDl.createdAt).getTime();
      const deltaMin = Math.round((dlTime - captureTime) / 60000);
      w.kv("Time to First Download", `${deltaMin} minutes after payment`);
    }
  } else {
    w.text("No completed downloads yet - correlation not available.", 0, 8, { color: C.textMut });
    w.y -= 12;
    if (checkoutIp) w.kv("Checkout IP", checkoutIp);
    if (checkoutCountry) w.kv("Checkout Location", `${checkoutCountry}${checkoutCity ? `, ${checkoutCity}` : ""}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION F: PAYMENT DETAILS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (isManualSale) {
    w.sectionTitle("5. PAYMENT DETAILS (Manual Sale / Invoice)");
    const method = manualPaymentData?.method ? String(manualPaymentData.method) : "manual";
    w.kv("Payment Method", method === "paypal_invoice" ? "PayPal Invoice" : "Manual Payment");
    w.kv("Payment Reference", manualPaymentData?.paymentRef ? String(manualPaymentData.paymentRef) : "N/A");
    w.kv("Amount", `$${String(order.amountUsd)} ${order.currency}`);
    w.kv("Manual Sale ID", manualPaymentData?.manualSaleId ? String(manualPaymentData.manualSaleId) : "N/A");
    if (paymentRecordedEvent) {
      w.kv("Payment Recorded At", fmtDate(paymentRecordedEvent.createdAt));
      w.kv("Recorded IP", paymentRecordedEvent.ipAddress || "N/A");
    }
    if (redeemCompletedEvent) {
      w.kv("Redeem Completed At", fmtDate(redeemCompletedEvent.createdAt));
      w.kv("Redeem IP", redeemCompletedEvent.ipAddress || "N/A");
      w.kv("Redeem UA", truncate(redeemCompletedEvent.userAgent || "N/A", 80));
    }
    w.note(
      "This order was created via the Manual Sales / Redeem Link flow. Payment was processed outside the standard checkout (e.g. PayPal Invoice). The buyer redeemed a secure link, accepted Terms of Service, and activated the license within the store.",
      C.warningBg, rgb(0.573, 0.251, 0.055), C.warning
    );
  } else {
    w.sectionTitle("5. PAYPAL PAYMENT DETAILS (Extract)");
    w.kv("PayPal Order ID", order.paypalOrderId || "N/A");
    w.kv("PayPal Capture ID", order.paypalCaptureId || "N/A");
    w.kv("PayPal Status", order.paypalStatus || "N/A");
    w.kv("Amount", `$${String(order.amountUsd)} ${order.currency}`);
    w.kv("Payer ID", order.paypalPayerId || "N/A");
    w.kv("Payer Email", order.paypalPayerEmail || "N/A");
    w.kv("Payer Name", order.paypalPayerName || "N/A");

    // Extract additional fields from rawCapture if available
    const raw = order.paypalRawCapture as Record<string, unknown> | null;
    const sandboxFallback = "Not provided by PayPal in this environment (sandbox)";
    if (raw) {
      w.kv("PayPal Create Time", raw.create_time ? safeStr(raw.create_time) : sandboxFallback);
      w.kv("PayPal Update Time", raw.update_time ? safeStr(raw.update_time) : sandboxFallback);
      const pu = raw.purchase_units as Array<Record<string, unknown>> | undefined;
      if (pu && pu[0]) {
        const payee = pu[0].payee as Record<string, unknown> | undefined;
        if (payee) {
          w.kv("Merchant Email", safeStr(payee.email_address));
          w.kv("Merchant ID", safeStr(payee.merchant_id));
        }
      }
    } else {
      w.kv("PayPal Create Time", sandboxFallback);
      w.kv("PayPal Update Time", sandboxFallback);
    }

    if (order.paypalWebhookReceivedAt) {
      w.kv("Verification", `Webhook received at ${fmtDate(order.paypalWebhookReceivedAt)}`);
    } else {
      w.kv("Verification", "Capture verified via PayPal Orders API (no webhook)");
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 4: TERMS OF SERVICE ACCEPTANCE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("6. TERMS OF SERVICE ACCEPTANCE");
  w.kv("Terms Version", order.termsVersion.versionLabel);
  w.kv("Content Hash (SHA256)", order.termsVersion.contentHash);
  w.kv("Accepted At", fmtDate(order.termsAcceptedAt));
  w.kv("Accepted IP", order.termsAcceptedIp || "N/A");
  w.kv("Accepted UA", truncate(order.termsAcceptedUa || "N/A", 100));
  w.note(
    `Terms content (first 400 chars): ${truncate(order.termsVersion.content, 400)}`,
    C.warningBg, rgb(0.573, 0.251, 0.055), C.warning
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION H: REFUND POLICY & DIGITAL ACKNOWLEDGEMENT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("7. REFUND POLICY & DIGITAL ACKNOWLEDGEMENT");
  w.note(
    "Digital goods delivered instantly. No refunds after delivery/download except as required by applicable local law. The buyer explicitly acknowledged this policy before completing the purchase.",
    C.warningBg, rgb(0.573, 0.251, 0.055), C.warning
  );
  w.kv("ToS Version", order.termsVersion.versionLabel);
  w.kv("ToS Hash", order.termsVersion.contentHash);
  w.kv("Accepted At", fmtDate(order.termsAcceptedAt));
  w.kv("Accepted IP", order.termsAcceptedIp || "N/A");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 5: LICENSE INFORMATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (order.license) {
    w.sectionTitle("8. LICENSE INFORMATION");
    w.kv("License Key", order.license.licenseKey);
    w.kv("Fingerprint", order.license.fingerprint);
    w.kv("Status", order.license.status);
    w.kv("Created", fmtDate(order.license.createdAt));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION G: PRODUCT SNAPSHOT (Human Readable)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("9. PRODUCT SNAPSHOT (Human Readable)");
  w.kv("Product Name", order.product.name);
  w.kv("Category", order.product.category);
  w.kv("Slug", order.product.slug);
  if (order.product.shortDescription) {
    w.kv("Description", truncate(order.product.shortDescription, 120));
  }
  const meta = order.product.metadata as Record<string, unknown> | null;
  if (meta) {
    if (meta.version) w.kv("Version", safeStr(meta.version));
    if (meta.mc_versions) w.kv("MC Versions", safeStr(meta.mc_versions));
    if (meta.platforms) w.kv("Platforms", safeStr(meta.platforms));
  }
  w.kv("Price (locked)", `$${String(order.amountUsd)} ${order.currency}`);

  // Product files list
  if (order.product.files && order.product.files.length > 0) {
    w.ensureSpace(14);
    w.text("Included Files:", 0, 8, { font: w.fontBold, color: C.textSec });
    w.y -= 12;
    for (const f of order.product.files) {
      w.ensureSpace(20);
      w.text(`${f.filename} (${fmtSize(f.fileSize)}) [${f.mimeType}]`, 6, 7, { color: C.textSec });
      w.y -= 9;
      w.text(`SHA256: ${f.sha256Hash}`, 6, 6, { font: w.fontMono, color: C.textMut });
      w.y -= 10;
    }
  }

  // JSON snapshot reference
  if (order.snapshots.length > 0) {
    w.ensureSpace(14);
    w.text("Full JSON snapshot stored separately (see Forensic Snapshots section).", 0, 7, { color: C.textMut });
    w.y -= 12;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION B: DOWNLOAD HISTORY (Strong Proof)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("10. DOWNLOAD HISTORY (Detailed)");
  w.kv("Total Downloads", `${order.downloadCount} / ${order.downloadLimit}`);
  w.kv("Downloads Expire", fmtDate(order.downloadsExpireAt));
  w.kv("Downloads Revoked", order.downloadsRevoked ? "YES" : "NO");

  if (dlCompletedEvents.length > 0) {
    // Table header
    w.ensureSpace(20);
    w.y -= 4;
    w.text("Timestamp", 0, 7, { font: w.fontBold, color: C.textSec });
    w.text("File", 120, 7, { font: w.fontBold, color: C.textSec });
    w.text("Size", 250, 7, { font: w.fontBold, color: C.textSec });
    w.text("SHA256", 300, 7, { font: w.fontBold, color: C.textSec });
    w.text("IP", 370, 7, { font: w.fontBold, color: C.textSec });
    w.text("Result", 440, 7, { font: w.fontBold, color: C.textSec });
    w.y -= 3;
    w.line(0, w.contentW, C.border);
    w.y -= 8;

    for (const ev of dlCompletedEvents) {
      const d = ev.eventData as Record<string, unknown>;
      w.ensureSpace(22);
      w.text(fmtDate(ev.createdAt).substring(0, 19), 0, 6, { font: w.fontMono, color: C.textSec });
      w.text(truncate(safeStr(d.filename), 18), 120, 6, { color: C.textSec });
      w.text(fmtSize(d.fileSizeBytes as number | null), 250, 6, { color: C.textSec });
      w.text(truncate(safeStr(d.fileSha256), 10), 300, 6, { font: w.fontMono, color: C.textMut });
      w.text(ev.ipAddress || "N/A", 370, 6, { color: C.textSec });
      w.text(safeStr(d.result), 440, 6, { color: safeStr(d.result).startsWith("OK") ? C.success : C.danger });
      w.y -= 9;
      // UA on second line
      if (ev.userAgent) {
        w.text(`UA: ${truncate(ev.userAgent, 90)}`, 6, 5, { color: C.textMut });
        w.y -= 8;
      }
    }
  }

  // Also show denied downloads
  const dlDenied = order.events.filter((e) => e.eventType === "download.denied" || e.eventType === "download.denied_frozen");
  if (dlDenied.length > 0) {
    w.ensureSpace(16);
    w.text("Denied Download Attempts:", 0, 7, { font: w.fontBold, color: C.danger });
    w.y -= 10;
    for (const ev of dlDenied) {
      const d = ev.eventData as Record<string, unknown>;
      w.ensureSpace(12);
      w.text(`${fmtDate(ev.createdAt)}  ${safeStr(d.result)}  IP: ${ev.ipAddress || "N/A"}`, 6, 6, { color: C.danger });
      w.y -= 9;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 7: DELIVERY STAGES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (order.deliveryStages.length > 0) {
    w.sectionTitle("11. DELIVERY STAGES");
    for (const stage of order.deliveryStages) {
      w.ensureSpace(30);
      w.text(`Stage ${stage.stageOrder} (${stage.stageType}) - ${stage.status.toUpperCase()}`, 0, 8, { font: w.fontBold });
      w.y -= 10;
      w.text(`File: ${stage.filename || "N/A"} | Size: ${fmtSize(stage.fileSize)}`, 6, 7, { color: C.textSec });
      w.y -= 9;
      w.text(`SHA256: ${stage.sha256Hash || "N/A"}`, 6, 6, { font: w.fontMono, color: C.textMut });
      w.y -= 9;
      w.text(`Downloads: ${stage.downloadCount}/${stage.downloadLimit} | Released: ${fmtDate(stage.releasedAt)}`, 6, 7, { color: C.textSec });
      w.y -= 12;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION C: PROOF OF ACCESS (Web Activity)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("12. PROOF OF ACCESS (Web Activity)");
  if (webActivityEvents.length > 0) {
    for (const ev of webActivityEvents) {
      w.ensureSpace(18);
      w.text(`[${fmtDate(ev.createdAt)}] ${ev.eventType}`, 0, 7, { font: w.fontBold, color: C.accent });
      w.y -= 9;
      w.text(`IP: ${ev.ipAddress || "N/A"} | UA: ${truncate(ev.userAgent || "N/A", 70)}`, 6, 6, { color: C.textSec });
      w.y -= 10;
    }
  } else {
    w.text("No web activity events recorded yet.", 0, 8, { color: C.textMut });
    w.y -= 12;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION E: EMAIL DELIVERY LOG
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("13. EMAIL DELIVERY LOG");
  const deliveryCompletedForEmail = dlCompletedEvents.length > 0;
  if (emailEvents.length > 0) {
    for (const ev of emailEvents) {
      const d = ev.eventData as Record<string, unknown>;
      w.ensureSpace(28);

      if (ev.eventType === "email.skipped") {
        // SKIPPED — not configured or disabled
        const reason = safeStr(d.reason);
        w.text(`[SKIPPED] email.skipped`, 0, 7, { font: w.fontBold, color: C.textMut });
        w.y -= 9;
        w.text(`Time: ${fmtDate(ev.createdAt)} | To: ${safeStr(d.to)} | Reason: ${reason}`, 6, 6, { color: C.textSec });
        w.y -= 9;
        if (deliveryCompletedForEmail) {
          w.text("Non-critical: digital delivery completed via direct download.", 6, 6, { color: C.success });
        } else {
          w.text("Note: email not sent and delivery not yet completed.", 6, 6, { color: C.warning });
        }
        w.y -= 9;
      } else if (ev.eventType === "email.failed") {
        // FAILED — real send attempt failed
        w.text(`[FAILED] email.failed`, 0, 7, { font: w.fontBold, color: C.danger });
        w.y -= 9;
        w.text(`Time: ${fmtDate(ev.createdAt)} | To: ${safeStr(d.to)} | Provider: ${safeStr(d.provider || d.smtpHost)}`, 6, 6, { color: C.textSec });
        w.y -= 9;
        if (d.error) {
          w.text(`Error: ${truncate(safeStr(d.error), 80)}`, 6, 6, { color: C.danger });
          w.y -= 9;
        }
        if (deliveryCompletedForEmail) {
          w.text("Non-critical: delivery completed via direct download despite email failure.", 6, 6, { color: C.success });
        } else {
          w.text("CRITICAL: email failed and delivery not yet completed.", 6, 6, { font: w.fontBold, color: C.danger });
        }
        w.y -= 9;
      } else {
        // SENT — success
        w.text(`[SENT] ${ev.eventType}`, 0, 7, { font: w.fontBold, color: C.success });
        w.y -= 9;
        w.text(`Time: ${fmtDate(ev.createdAt)} | To: ${safeStr(d.to)} | Provider: ${safeStr(d.provider || d.smtpHost)}`, 6, 6, { color: C.textSec });
        w.y -= 9;
        if (d.messageId) {
          w.text(`Message-ID: ${safeStr(d.messageId)}`, 6, 6, { font: w.fontMono, color: C.textMut });
          w.y -= 9;
        }
      }
      w.y -= 3;
    }
  } else {
    w.text("No email events recorded.", 0, 8, { color: C.textMut });
    w.y -= 12;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 10: ADMIN ACTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("14. ADMIN ACTIONS LOG");
  if (adminEvents.length > 0) {
    for (const ev of adminEvents) {
      const d = ev.eventData as Record<string, unknown>;
      w.ensureSpace(20);
      w.text(`[${fmtDate(ev.createdAt)}] ${ev.eventType}`, 0, 8, { font: w.fontBold, color: C.accent });
      w.y -= 10;
      for (const [k, v] of Object.entries(d)) {
        w.text(`${k}: ${String(v)}`, 6, 7, { color: C.textSec });
        w.y -= 9;
      }
      w.y -= 4;
    }
  } else {
    w.text("No admin actions recorded.", 0, 8, { color: C.textMut });
    w.y -= 12;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 11: FORENSIC SNAPSHOTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("15. FORENSIC PRODUCT SNAPSHOTS");
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 12: CHAIN INTEGRITY + COMPLETE EVENT CHAIN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  w.sectionTitle("16. TAMPER-EVIDENT EVENT CHAIN");
  w.badge(chain.valid ? "CHAIN VALID" : "CHAIN BROKEN", chain.valid);
  w.kv("Total Events", String(chain.totalEvents));
  w.kv("First Event", fmtDate(chain.firstEventAt));
  w.kv("Last Event", fmtDate(chain.lastEventAt));
  if (!chain.valid && chain.brokenAtSequence) {
    w.kv("Broken at Seq", `#${chain.brokenAtSequence}`);
  }

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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SECTION 13: DISPUTE MODE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (order.evidenceFrozenAt) {
    w.sectionTitle("17. DISPUTE MODE STATUS");
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
