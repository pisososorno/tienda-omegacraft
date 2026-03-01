"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  Clock,
  Mail,
  Hash,
  AlertTriangle,
  Loader2,
  Unlock,
  Link as LinkIcon,
  Paperclip,
  Upload,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface OrderDetail {
  id: string;
  orderNumber: string;
  buyerEmail: string;
  buyerIp: string;
  buyerUserAgent: string | null;
  amountUsd: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paymentReferenceUrl: string | null;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  paypalPayerEmail: string | null;
  paypalInvoiceId: string | null;
  paypalInvoiceNumber: string | null;
  paypalTransactionId: string | null;
  downloadCount: number;
  downloadLimit: number;
  downloadsExpireAt: string | null;
  downloadsRevoked: boolean;
  termsAcceptedAt: string;
  termsAcceptedIp: string;
  termsVersion: { versionLabel: string; contentHash: string };
  evidenceFrozenAt: string | null;
  evidenceFrozenByAdmin: string | null;
  retentionExpiresAt: string | null;
  createdAt: string;
  product: { id: string; name: string; slug: string; category: string; priceUsd: string };
  license: { licenseKey: string; fingerprint: string; status: string } | null;
  events: EventItem[];
  snapshots: SnapshotItem[];
  stages: StageItem[];
  chainIntegrity: ChainIntegrity;
}

interface EventItem {
  id: string;
  sequenceNumber: number;
  eventType: string;
  eventData: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  externalRef: string | null;
  prevHash: string | null;
  eventHash: string;
  createdAt: string;
}

interface SnapshotItem {
  id: string;
  snapshotType: string;
  snapshotHash: string;
  createdAt: string;
}

interface StageItem {
  id: string;
  stageType: string;
  stageOrder: number;
  status: string;
  filename: string | null;
  fileSize: string | null;
  sha256Hash: string | null;
  downloadCount: number;
  downloadLimit: number;
  releasedAt: string | null;
  createdAt: string;
}

interface ChainIntegrity {
  valid: boolean;
  totalEvents: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
  brokenAtSequence: number | null;
}

interface AttachmentItem {
  id: string;
  type: string;
  filename: string;
  fileSize: string;
  sha256Hash: string;
  mimeType: string;
  description: string | null;
  createdBy: { name: string; email: string };
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  refunded: "bg-red-100 text-red-800",
  disputed: "bg-orange-100 text-orange-800",
  revoked: "bg-gray-100 text-gray-800",
  frozen: "bg-blue-100 text-blue-800",
};

const eventIcons: Record<string, string> = {
  "order.created": "📦",
  "terms.accepted": "📜",
  "payment.captured": "💰",
  "payment.capture_failed": "❌",
  "payment.refunded": "💸",
  "license.created": "🔑",
  "download.token_generated": "🔗",
  "download.completed": "✅",
  "download.denied": "🚫",
  "download.denied_frozen": "🧊",
  "download.access_page_viewed": "👁️",
  "webhook.payment_confirmed": "🔔",
  "dispute.created": "⚠️",
  "admin.dispute_mode_activated": "🛡️",
  "admin.downloads_revoked": "🔒",
  "admin.stage_released": "📤",
  "email.purchase_sent": "📧",
  "email.stage_released_sent": "📧",
  "redeem.page_viewed": "👁️",
  "redeem.payment_page_viewed": "💳",
  "redeem.payment_link_clicked": "🔗",
  "redeem.terms_link_clicked": "📜",
  "redeem.terms_accepted": "✅",
  "redeem.confirm_clicked": "🖱️",
  "redeem.completed": "🎉",
  "payment.recorded": "💰",
  "admin.evidence_attached": "📎",
};

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachDesc, setAttachDesc] = useState("");
  const [attachType, setAttachType] = useState("screenshot");

  const fetchOrder = useCallback(() => {
    if (!params.id) return;
    fetch(`/api/admin/orders/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  const fetchAttachments = useCallback(() => {
    if (!params.id) return;
    fetch(`/api/admin/orders/${params.id}/evidence-attachments`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAttachments(data); })
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    fetchOrder();
    fetchAttachments();
  }, [fetchOrder, fetchAttachments]);

  async function handleAttachUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !order) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", attachType);
      fd.append("description", attachDesc);
      const res = await fetch(`/api/admin/orders/${order.id}/evidence-attachments`, { method: "POST", body: fd });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Upload failed"); return; }
      setAttachDesc("");
      fetchAttachments();
      fetchOrder(); // refresh events
    } catch { alert("Upload failed"); } finally { setUploading(false); e.target.value = ""; }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!order || !confirm("Delete this evidence attachment?")) return;
    try {
      await fetch(`/api/admin/orders/${order.id}/evidence-attachments?attachmentId=${attachmentId}`, { method: "DELETE" });
      fetchAttachments();
    } catch { alert("Delete failed"); }
  }

  async function activateDisputeMode() {
    if (!order || !confirm("Activate dispute mode? This will freeze all evidence and revoke downloads.")) return;
    setActionLoading("dispute");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/dispute-mode`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      fetchOrder();
    } catch { alert("Failed"); } finally { setActionLoading(null); }
  }

  async function releaseStage(stageId: string) {
    if (!order || !confirm("Release this stage? The buyer will receive a download link.")) return;
    setActionLoading(`stage-${stageId}`);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/stages/${stageId}/release`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      alert(`Stage released. Download URL sent to buyer.`);
      fetchOrder();
    } catch { alert("Failed"); } finally { setActionLoading(null); }
  }

  async function verifyChain() {
    if (!order) return;
    setActionLoading("verify");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/verify-chain`);
      const data = await res.json();
      if (data.valid) {
        alert(`✅ Chain VALID — ${data.totalEvents} events verified.`);
      } else {
        const detail = data.detail ? `\nDetail: ${data.detail}` : "";
        const msg = `❌ Chain BROKEN at sequence #${data.brokenAtSequence}!\nExpected: ${data.expectedHash}\nActual: ${data.actualHash}${detail}\n\n¿Deseas re-sellar la cadena? (Esto recalcula todos los hashes con serialización canónica)`;
        if (confirm(msg)) {
          await resealChain();
        }
      }
    } catch { alert("Verification failed"); } finally { setActionLoading(null); }
  }

  async function resealChain() {
    if (!order) return;
    setActionLoading("verify");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/reseal-chain`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Reseal failed"); return; }
      if (data.chainValidAfter) {
        alert(`✅ Chain RESEALED — ${data.resealed}/${data.totalEvents} events updated. Chain is now VALID.`);
      } else {
        alert(`⚠ Resealed ${data.resealed} events but chain is still invalid. Check server logs.`);
      }
    } catch { alert("Reseal failed"); } finally { setActionLoading(null); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Order not found</h1>
        <Button variant="outline" onClick={() => router.push("/admin/orders")}>Back to orders</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Button variant="ghost" size="sm" className="mb-6 gap-2" onClick={() => router.push("/admin/orders")}>
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
            <Badge variant="secondary" className={statusColors[order.status] || ""}>{order.status}</Badge>
            {order.evidenceFrozenAt && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 gap-1">
                <Shield className="h-3 w-3" /> Frozen
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {order.product.name} &middot; ${order.amountUsd} &middot; {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={verifyChain} disabled={!!actionLoading}>
            {actionLoading === "verify" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hash className="h-3.5 w-3.5" />}
            Verify Chain
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(`/api/admin/orders/${order.id}/evidence-pdf`, "_blank")}>
            <FileText className="h-3.5 w-3.5" /> Export PDF
          </Button>
          {!order.evidenceFrozenAt && (
            <Button variant="destructive" size="sm" className="gap-1" onClick={activateDisputeMode} disabled={!!actionLoading}>
              {actionLoading === "dispute" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              Dispute Mode
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — info + stages */}
        <div className="lg:col-span-1 space-y-4">
          {/* Buyer Info */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Buyer</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Email:</span> {order.buyerEmail}</p>
              <p><span className="text-muted-foreground">IP:</span> {order.buyerIp}</p>
              {order.paypalPayerEmail && <p><span className="text-muted-foreground">PayPal:</span> {order.paypalPayerEmail}</p>}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Payment</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Method:</span> {order.paymentMethod === "paypal_invoice" ? "PayPal Invoice" : order.paymentMethod === "paypal_orders" ? "PayPal Checkout" : order.paymentMethod || "—"}</p>
              <p><span className="text-muted-foreground">Amount:</span> ${order.amountUsd} {order.currency}</p>
              {order.paymentMethod === "paypal_invoice" ? (
                <>
                  {order.paypalInvoiceId && <p><span className="text-muted-foreground">Invoice ID:</span> <code className="text-xs">{order.paypalInvoiceId}</code></p>}
                  {order.paypalInvoiceNumber && <p><span className="text-muted-foreground">Invoice #:</span> <code className="text-xs">{order.paypalInvoiceNumber}</code></p>}
                  {order.paypalTransactionId && <p><span className="text-muted-foreground">Transaction:</span> <code className="text-xs">{order.paypalTransactionId}</code></p>}
                  {order.paymentReferenceUrl && <p><span className="text-muted-foreground">Ref URL:</span> <a href={order.paymentReferenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">{order.paymentReferenceUrl.substring(0, 50)}...</a></p>}
                </>
              ) : (
                <>
                  <p><span className="text-muted-foreground">PayPal Order:</span> <code className="text-xs">{order.paypalOrderId || "—"}</code></p>
                  <p><span className="text-muted-foreground">Capture:</span> <code className="text-xs">{order.paypalCaptureId || "—"}</code></p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Downloads */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Downloads</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Count:</span> {order.downloadCount}/{order.downloadLimit}</p>
              <p><span className="text-muted-foreground">Expires:</span> {order.downloadsExpireAt ? new Date(order.downloadsExpireAt).toLocaleDateString() : "—"}</p>
              <p><span className="text-muted-foreground">Revoked:</span> {order.downloadsRevoked ? "Yes" : "No"}</p>
            </CardContent>
          </Card>

          {/* License */}
          {order.license && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">License</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Key:</span> <code className="text-xs">{order.license.licenseKey}</code></p>
                <p><span className="text-muted-foreground">Fingerprint:</span> <code className="text-xs break-all">{order.license.fingerprint}</code></p>
                <p><span className="text-muted-foreground">Status:</span> {order.license.status}</p>
              </CardContent>
            </Card>
          )}

          {/* Chain Integrity */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Chain Integrity</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                {order.chainIntegrity.valid ? (
                  <><ShieldCheck className="h-4 w-4 text-green-600" /> <span className="text-green-700 font-medium">VALID</span></>
                ) : (
                  <><XCircle className="h-4 w-4 text-red-600" /> <span className="text-red-700 font-medium">BROKEN at #{order.chainIntegrity.brokenAtSequence}</span></>
                )}
              </div>
              <p><span className="text-muted-foreground">Events:</span> {order.chainIntegrity.totalEvents}</p>
            </CardContent>
          </Card>

          {/* Terms */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Terms Acceptance</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Version:</span> {order.termsVersion.versionLabel}</p>
              <p><span className="text-muted-foreground">Hash:</span> <code className="text-xs">{order.termsVersion.contentHash.substring(0, 16)}...</code></p>
              <p><span className="text-muted-foreground">Accepted:</span> {new Date(order.termsAcceptedAt).toLocaleString()}</p>
              <p><span className="text-muted-foreground">IP:</span> {order.termsAcceptedIp}</p>
            </CardContent>
          </Card>

          {/* Delivery Stages */}
          {order.stages.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Delivery Stages</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {order.stages.map((stage) => (
                  <div key={stage.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        Stage {stage.stageOrder}: {stage.stageType === "preview" ? "Preview" : "Full Source"}
                      </span>
                      <Badge variant="outline" className="text-xs">{stage.status}</Badge>
                    </div>
                    {stage.filename && <p className="text-xs text-muted-foreground">{stage.filename}</p>}
                    <p className="text-xs text-muted-foreground">
                      Downloads: {stage.downloadCount}/{stage.downloadLimit}
                      {stage.sha256Hash && <> &middot; <code>{stage.sha256Hash.substring(0, 12)}...</code></>}
                    </p>
                    {stage.status === "pending" && !order.evidenceFrozenAt && (
                      <Button
                        size="sm" variant="outline" className="w-full gap-1 mt-1"
                        onClick={() => releaseStage(stage.id)}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === `stage-${stage.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
                        Release Stage
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Evidence Attachments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> Evidence Attachments
                {attachments.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{attachments.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Upload form */}
              <div className="border rounded-lg p-2.5 space-y-2 bg-muted/30">
                <div className="flex gap-2">
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs flex-shrink-0"
                    value={attachType}
                    onChange={(e) => setAttachType(e.target.value)}
                  >
                    <option value="screenshot">Screenshot</option>
                    <option value="pdf">PDF</option>
                    <option value="receipt">Receipt</option>
                    <option value="html">HTML</option>
                    <option value="text">Text</option>
                  </select>
                  <input
                    type="text"
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                    placeholder="Description (optional)"
                    value={attachDesc}
                    onChange={(e) => setAttachDesc(e.target.value)}
                  />
                </div>
                <label className="flex items-center justify-center gap-1.5 border-2 border-dashed rounded-md p-2 cursor-pointer hover:bg-muted/50 transition-colors">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{uploading ? "Uploading..." : "Upload file (PNG, JPG, PDF, HTML, max 20MB)"}</span>
                  <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,application/pdf,text/html,text/plain" onChange={handleAttachUpload} disabled={uploading} />
                </label>
              </div>
              {/* Attachment list */}
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 text-xs border rounded p-2">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{a.filename}</p>
                        <p className="text-muted-foreground">{a.type} &middot; {(Number(a.fileSize) / 1024).toFixed(0)} KB &middot; {new Date(a.createdAt).toLocaleString()}</p>
                        {a.description && <p className="text-muted-foreground italic">{a.description}</p>}
                        <code className="text-[10px] text-muted-foreground/60 break-all">sha256: {a.sha256Hash.substring(0, 24)}...</code>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive flex-shrink-0" onClick={() => handleDeleteAttachment(a.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1">No attachments yet</p>
              )}
            </CardContent>
          </Card>

          {/* Snapshots */}
          {order.snapshots.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Forensic Snapshots</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {order.snapshots.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="uppercase text-xs font-medium">{s.snapshotType}</span>
                    <code className="text-xs text-muted-foreground">{s.snapshotHash.substring(0, 12)}...</code>
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(s.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Dispute Info */}
          {order.evidenceFrozenAt && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-blue-800">Dispute Mode Active</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1 text-blue-900">
                <p><span className="text-blue-700">Frozen at:</span> {new Date(order.evidenceFrozenAt).toLocaleString()}</p>
                <p><span className="text-blue-700">Frozen by:</span> {order.evidenceFrozenByAdmin}</p>
                <p><span className="text-blue-700">Retention until:</span> {order.retentionExpiresAt ? new Date(order.retentionExpiresAt).toLocaleDateString() : "—"}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — Event Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Event Timeline
                <span className="text-muted-foreground font-normal">{order.events.length} events</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {order.events.map((event, idx) => (
                  <div key={event.id} className="flex gap-3 pb-4 relative">
                    {/* Connector line */}
                    {idx < order.events.length - 1 && (
                      <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                    )}
                    {/* Icon */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm z-10">
                      {eventIcons[event.eventType] || "📋"}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{event.eventType}</span>
                        <span className="text-xs text-muted-foreground">#{event.sequenceNumber}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {/* Event data summary */}
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {event.ipAddress && <p>IP: {event.ipAddress}</p>}
                        {event.externalRef && (
                          <p className="flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" /> {event.externalRef}
                          </p>
                        )}
                        {Object.entries(event.eventData as Record<string, unknown>)
                          .filter(([k]) => !["source"].includes(k))
                          .slice(0, 4)
                          .map(([key, val]) => (
                            <p key={key}>
                              <span className="text-muted-foreground/70">{key}:</span>{" "}
                              <code className="text-xs">{String(val).substring(0, 60)}</code>
                            </p>
                          ))}
                      </div>
                      {/* Hash chain info */}
                      <div className="text-[10px] text-muted-foreground/50 mt-1 font-mono">
                        hash: {event.eventHash.substring(0, 16)}...
                        {event.prevHash ? ` ← prev: ${event.prevHash.substring(0, 12)}...` : " (GENESIS)"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
