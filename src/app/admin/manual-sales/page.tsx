"use client";

import { useEffect, useState } from "react";
import { Plus, Copy, Loader2, Receipt, ExternalLink, Ban, Clock, CheckCircle, DollarSign, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Product {
  id: string;
  name: string;
  slug: string;
  priceUsd: string;
}

interface ManualSaleItem {
  id: string;
  status: string;
  buyerEmail: string;
  buyerName: string | null;
  product: { id: string; name: string; slug: string; priceUsd: string };
  amount: string;
  currency: string;
  paymentMethod: string;
  paymentRef: string | null;
  paidAt: string | null;
  requirePaymentFirst: boolean;
  redeemExpiresAt: string;
  maxRedeems: number;
  redeemCount: number;
  redeemedAt: string | null;
  orderId: string | null;
  order: { id: string; orderNumber: string; status: string } | null;
  notes: string | null;
  createdBy: { id: string; name: string; email: string };
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-yellow-100 text-yellow-700",
  paid: "bg-blue-100 text-blue-700",
  redeemed: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  canceled: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  paid: "Pagado",
  redeemed: "Canjeado",
  expired: "Expirado",
  canceled: "Cancelado",
};

export default function ManualSalesPage() {
  const [sales, setSales] = useState<ManualSaleItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Create form
  const [form, setForm] = useState({
    buyerEmail: "",
    buyerName: "",
    productId: "",
    amount: "",
    paymentMethod: "paypal_invoice",
    paymentRef: "",
    notes: "",
    requirePaymentFirst: false,
    redeemExpiresDays: "7",
    maxRedeems: "1",
  });

  // New sale result
  const [createResult, setCreateResult] = useState<{
    redeemUrl: string;
    templateMessage: string;
  } | null>(null);

  function fetchSales() {
    setLoading(true);
    fetch("/api/admin/manual-sales")
      .then((r) => r.json())
      .then(setSales)
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }

  function fetchProducts() {
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((data: Product[]) => setProducts(data))
      .catch(() => setProducts([]));
  }

  useEffect(() => {
    fetchSales();
    fetchProducts();
  }, []);

  async function handleCreate() {
    if (!form.buyerEmail || !form.productId) {
      setError("Email del comprador y producto son obligatorios.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/manual-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail: form.buyerEmail,
          buyerName: form.buyerName || null,
          productId: form.productId,
          amount: form.amount || undefined,
          paymentMethod: form.paymentMethod,
          paymentRef: form.paymentRef || null,
          notes: form.notes || null,
          requirePaymentFirst: form.requirePaymentFirst,
          redeemExpiresDays: parseInt(form.redeemExpiresDays) || 7,
          maxRedeems: parseInt(form.maxRedeems) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear");
      setCreateResult({ redeemUrl: data.redeemUrl, templateMessage: data.templateMessage });
      fetchSales();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreating(false);
    }
  }

  async function handleAction(id: string, action: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/manual-sales/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      fetchSales();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("ELIMINAR esta venta manual permanentemente?\n\nSi tiene una orden vinculada, tambien se eliminara con todos sus registros (eventos, licencia, tokens, etc).\n\nEsta accion NO se puede deshacer.")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/manual-sales/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al eliminar");
      }
      fetchSales();
    } catch {
      alert("Error de red al eliminar");
    } finally {
      setActionLoading(null);
    }
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Manual Sales
          </h1>
          <p className="text-muted-foreground text-sm">
            Ventas por factura PayPal o acuerdos directos
          </p>
        </div>
        <Button className="gap-2" onClick={() => { setShowCreate(true); setCreateResult(null); }}>
          <Plus className="h-4 w-4" />
          Nueva Venta Manual
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Crear Venta Manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {createResult ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800 mb-2">¡Venta creada! Comparte este enlace:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white p-2 rounded border break-all">
                      {createResult.redeemUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(createResult.redeemUrl, "url")}
                    >
                      <Copy className="h-4 w-4" />
                      {copied === "url" ? " Copiado!" : ""}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Mensaje plantilla:</p>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={createResult.templateMessage}
                      className="w-full rounded-md border bg-slate-50 px-3 py-2 text-sm min-h-[80px]"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1"
                      onClick={() => copyText(createResult.templateMessage, "msg")}
                    >
                      <Copy className="h-3 w-3" />
                      {copied === "msg" ? " Copiado!" : ""}
                    </Button>
                  </div>
                </div>
                <Button variant="outline" onClick={() => { setShowCreate(false); setCreateResult(null); }}>
                  Cerrar
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Email comprador *</label>
                    <Input
                      type="email"
                      value={form.buyerEmail}
                      onChange={(e) => setForm((f) => ({ ...f, buyerEmail: e.target.value }))}
                      placeholder="buyer@email.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Nombre (opcional)</label>
                    <Input
                      value={form.buyerName}
                      onChange={(e) => setForm((f) => ({ ...f, buyerName: e.target.value }))}
                      placeholder="Nombre del comprador"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Producto *</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.productId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        setForm((f) => ({ ...f, productId: pid }));
                        const p = products.find((x) => x.id === pid);
                        if (p && !form.amount) setForm((f) => ({ ...f, amount: p.priceUsd }));
                      }}
                    >
                      <option value="">Seleccionar producto</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} (${p.priceUsd})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Monto USD</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="Auto desde producto"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Método de pago</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.paymentMethod}
                      onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                    >
                      <option value="paypal_invoice">PayPal Invoice</option>
                      <option value="manual">Manual / Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Referencia pago</label>
                    <Input
                      value={form.paymentRef}
                      onChange={(e) => setForm((f) => ({ ...f, paymentRef: e.target.value }))}
                      placeholder="Invoice ID, etc."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Expira en (días)</label>
                    <Input
                      type="number"
                      value={form.redeemExpiresDays}
                      onChange={(e) => setForm((f) => ({ ...f, redeemExpiresDays: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Notas internas</label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Notas opcionales"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.requirePaymentFirst}
                    onChange={(e) => setForm((f) => ({ ...f, requirePaymentFirst: e.target.checked }))}
                    className="rounded"
                  />
                  Requiere confirmación de pago antes de permitir redeem
                </label>

                {error && (
                  <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={creating} className="gap-2">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Crear y generar enlace
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sales list */}
      {sales.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay ventas manuales aún.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Comprador</th>
                <th className="text-left px-4 py-3 font-medium">Producto</th>
                <th className="text-left px-4 py-3 font-medium">Monto</th>
                <th className="text-left px-4 py-3 font-medium">Método</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Expira</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs">{s.buyerEmail}</div>
                    {s.buyerName && <div className="text-xs text-muted-foreground">{s.buyerName}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">{s.product.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">${s.amount} {s.currency}</td>
                  <td className="px-4 py-3 text-xs">{s.paymentMethod === "paypal_invoice" ? "PayPal Invoice" : "Manual"}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="secondary" className={statusColors[s.status] || ""}>
                      {statusLabels[s.status] || s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(s.redeemExpiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {s.order && (
                        <Button variant="ghost" size="icon" title="Ver orden" asChild>
                          <a href={`/admin/orders?id=${s.order.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {(s.status === "sent" || s.status === "draft") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Marcar como pagado"
                          disabled={actionLoading === s.id}
                          onClick={() => handleAction(s.id, "mark_paid")}
                        >
                          {actionLoading === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4 text-green-600" />}
                        </Button>
                      )}
                      {s.status !== "redeemed" && s.status !== "canceled" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Extender expiración"
                            disabled={actionLoading === s.id}
                            onClick={() => handleAction(s.id, "extend_expiry")}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cancelar"
                            className="text-destructive"
                            disabled={actionLoading === s.id}
                            onClick={() => {
                              if (confirm("¿Cancelar esta venta manual?")) handleAction(s.id, "cancel");
                            }}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {s.status === "redeemed" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Eliminar permanentemente"
                        className="text-destructive hover:text-destructive"
                        disabled={actionLoading === s.id}
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
