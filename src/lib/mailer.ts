import nodemailer from "nodemailer";
import { getSettings } from "@/lib/settings";
import { appendEvent } from "@/lib/forensic";

// ── Email Mode Detection ─────────────────────────────
type EmailMode = "disabled" | "smtp";

function getEmailMode(): EmailMode {
  const explicit = (process.env.EMAIL_MODE || "").toLowerCase().trim();
  if (explicit === "disabled") return "disabled";
  if (explicit === "smtp") return "smtp";
  // Auto-detect: if SMTP_HOST is set and looks real, use smtp
  if (isSmtpConfigured()) return "smtp";
  return "disabled";
}

function isSmtpConfigured(): boolean {
  const host = (process.env.SMTP_HOST || "").trim();
  if (!host) return false;
  // Reject obvious placeholders
  if (host === "smtp.example.com" || host === "localhost" || host === "mailhog") return false;
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  return !!(user && pass);
}

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

function getFromEmail(): string {
  return process.env.FROM_EMAIL || "noreply@tiendadigital.com";
}

function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const masked = local.length <= 2 ? "*" : local[0] + "***" + local[local.length - 1];
  return `${masked}@${domain}`;
}

export interface SendPurchaseEmailInput {
  buyerEmail: string;
  orderNumber: string;
  productName: string;
  downloadUrl: string;
  expiresAt: Date;
  downloadLimit: number;
  orderId: string;
}

/**
 * Send purchase confirmation + download link email.
 */
export async function sendPurchaseEmail(
  input: SendPurchaseEmailInput
): Promise<{ messageId: string }> {
  // Check if email is configured
  const mode = getEmailMode();
  if (mode === "disabled") {
    const reason = isSmtpConfigured() ? "disabled" : "not_configured";
    console.log(`[mailer] Email skipped (${reason}) for order ${input.orderNumber}`);
    if (input.orderId) {
      await appendEvent({
        orderId: input.orderId,
        eventType: "email.skipped",
        eventData: {
          emailType: "purchase",
          to: maskEmail(input.buyerEmail),
          reason,
          smtpHost: process.env.SMTP_HOST || "none",
        },
      }).catch(() => {});
    }
    return { messageId: `skipped-${reason}-${Date.now()}` };
  }

  const transporter = getTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px; border-radius: 12px; color: white; text-align: center; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 24px;">Thank you for your purchase!</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">Order ${input.orderNumber}</p>
  </div>

  <div style="background: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #1e293b;">📦 ${input.productName}</h2>
    <p style="margin: 0; color: #475569;">Your download is ready. Click the button below to access your files.</p>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${input.downloadUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
      Download Now
    </a>
  </div>

  <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
    <p style="margin: 0; color: #92400e; font-size: 14px;">
      <strong>Important:</strong><br>
      • Download limit: <strong>${input.downloadLimit} downloads</strong><br>
      • Link expires: <strong>${input.expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</strong><br>
      • You can also access your downloads from <a href="${getAppUrl()}/my-downloads" style="color: #2563eb;">My Downloads</a>
    </p>
  </div>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
  <p style="color: #94a3b8; font-size: 12px; text-align: center;">
    This email confirms your purchase and digital delivery.<br>
    If you did not make this purchase, please contact us immediately.<br>
    <a href="${getAppUrl()}/terms" style="color: #94a3b8;">Terms of Service</a>
  </p>
</body>
</html>`;

  const { storeName } = await getSettings();

  try {
    const result = await transporter.sendMail({
      from: `"${storeName}" <${getFromEmail()}>`,
      to: input.buyerEmail,
      subject: `Your download is ready — Order ${input.orderNumber}`,
      html,
      text: `Thank you for your purchase!\n\nOrder: ${input.orderNumber}\nProduct: ${input.productName}\n\nDownload your files: ${input.downloadUrl}\n\nDownload limit: ${input.downloadLimit} downloads\nLink expires: ${input.expiresAt.toISOString()}\n\nYou can also access your downloads at ${getAppUrl()}/my-downloads`,
    });

    // Log success to forensic chain
    if (input.orderId) {
      await appendEvent({
        orderId: input.orderId,
        eventType: "email.purchase_sent",
        eventData: {
          messageId: result.messageId,
          to: maskEmail(input.buyerEmail),
          provider: "smtp",
          smtpHost: process.env.SMTP_HOST || "unknown",
          status: "sent",
        },
      }).catch(() => {});
    }

    return { messageId: result.messageId };
  } catch (err) {
    // Log failure to forensic chain
    if (input.orderId) {
      await appendEvent({
        orderId: input.orderId,
        eventType: "email.failed",
        eventData: {
          emailType: "purchase",
          to: maskEmail(input.buyerEmail),
          provider: "smtp",
          smtpHost: process.env.SMTP_HOST || "unknown",
          error: err instanceof Error ? err.message : String(err),
          status: "failed",
        },
      }).catch(() => {});
    }
    throw err;
  }
}

export interface SendStageReleasedEmailInput {
  buyerEmail: string;
  orderNumber: string;
  productName: string;
  stageName: string;
  downloadUrl: string;
}

/**
 * Send stage released notification email.
 */
export async function sendStageReleasedEmail(
  input: SendStageReleasedEmailInput
): Promise<{ messageId: string }> {
  const mode = getEmailMode();
  if (mode === "disabled") {
    console.log(`[mailer] Stage email skipped (not configured) for order ${input.orderNumber}`);
    return { messageId: `skipped-not_configured-${Date.now()}` };
  }

  const transporter = getTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 32px; border-radius: 12px; color: white; text-align: center; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 24px;">New download available!</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">Order ${input.orderNumber}</p>
  </div>

  <div style="background: #f0fdf4; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #1e293b;">🎉 ${input.stageName} — ${input.productName}</h2>
    <p style="margin: 0; color: #475569;">A new stage of your purchase has been released and is ready for download.</p>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${input.downloadUrl}" style="display: inline-block; background: #059669; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
      Download Now
    </a>
  </div>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
  <p style="color: #94a3b8; font-size: 12px; text-align: center;">
    This is an automated notification for Order ${input.orderNumber}.<br>
    <a href="${getAppUrl()}/terms" style="color: #94a3b8;">Terms of Service</a>
  </p>
</body>
</html>`;

  const { storeName: sName } = await getSettings();

  const result = await transporter.sendMail({
    from: `"${sName}" <${getFromEmail()}>`,
    to: input.buyerEmail,
    subject: `New download available — ${input.stageName} — Order ${input.orderNumber}`,
    html,
    text: `New download available!\n\nOrder: ${input.orderNumber}\nProduct: ${input.productName}\nStage: ${input.stageName}\n\nDownload: ${input.downloadUrl}`,
  });

  return { messageId: result.messageId };
}
