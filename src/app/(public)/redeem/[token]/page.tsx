"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Package, Shield, Download, CheckCircle, Loader2, AlertCircle, Copy, ExternalLink, CreditCard, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatVersionLabel } from "@/lib/compatibility";

interface RedeemInfo {
  id: string;
  product: {
    name: string;
    slug: string;
    shortDescription: string | null;
    category: string;
    priceUsd: string;
    coverImage: string | null;
    supportedVersions: string[];
    platforms: string[];
    minecraftVersionMin: string | null;
    minecraftVersionMax: string | null;
  };
  amount: string;
  currency: string;
  paymentMethod: string;
  buyerName: string | null;
  expiresAt: string;
  pendingPayment?: boolean;
  paymentUrl?: string | null;
}

interface RedeemResult {
  orderId: string;
  orderNumber: string;
  downloadUrl: string;
  licenseKey: string;
  productName: string;
  expiresAt: string;
  downloadLimit: number;
}

const categoryLabels: Record<string, string> = {
  plugins: "Plugin",
  source_code: "Source Code",
  configurations: "Config Pack",
  maps: "Map",
};

export default function RedeemPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [info, setInfo] = useState<RedeemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadInfo = useCallback(async (isPolling = false) => {
    if (!token) return;
    try {
      const r = await fetch(`/api/redeem/${token}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Enlace no válido");
      setInfo(data);
      if (!isPolling && data.buyerName) setBuyerName(data.buyerName);
      setError("");
    } catch (err: unknown) {
      if (!isPolling) setError(err instanceof Error ? err.message : "Enlace no válido");
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    loadInfo(false);
  }, [loadInfo]);

  // Poll every 5s when payment is pending — uses PayPal Invoicing API if configured
  useEffect(() => {
    if (info?.pendingPayment) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch("/api/redeem/check-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const data = await res.json();
          if (data.paid) {
            // Payment confirmed! Reload full info to show redeem form
            await loadInfo(true);
          }
        } catch {
          // Silent fail on poll — will retry next interval
        }
      }, 5000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [info?.pendingPayment, loadInfo, token]);

  async function handleConfirm() {
    if (!termsAccepted) {
      setError("Debes aceptar los términos y condiciones");
      return;
    }
    setConfirming(true);
    setError("");
    try {
      const res = await fetch("/api/redeem/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, termsAccepted: true, buyerName: buyerName.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al activar");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setConfirming(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-muted-foreground">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // Error state (invalid/expired token)
  if (error && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Enlace no válido</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button variant="outline" onClick={() => router.push("/catalog")}>
              Ir al catálogo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state (redeemed)
  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-green-50 p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="py-8">
            <div className="text-center mb-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
              <h1 className="text-2xl font-bold mb-1">¡Compra activada!</h1>
              <p className="text-muted-foreground">Tu producto está listo para descargar.</p>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Producto</p>
                <p className="font-semibold">{result.productName}</p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Orden</p>
                <p className="font-mono font-semibold">{result.orderNumber}</p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Licencia</p>
                    <p className="font-mono font-semibold text-sm">{result.licenseKey}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(result.licenseKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {copied && <p className="text-xs text-green-600 mt-1">¡Copiado!</p>}
              </div>

              <a href={result.downloadUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2 h-12 text-base font-semibold" size="lg">
                  <Download className="h-5 w-5" />
                  Descargar ahora
                </Button>
              </a>

              <div className="text-center text-xs text-muted-foreground space-y-1">
                <p>Descargas disponibles: {result.downloadLimit}</p>
                <p>Enlace expira: {new Date(result.expiresAt).toLocaleString()}</p>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => router.push("/my-downloads")}
              >
                <ExternalLink className="h-4 w-4" />
                Ir a Mis Descargas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redeem form
  if (!info) return null;

  const vLabel = formatVersionLabel(
    info.product.supportedVersions || [],
    info.product.minecraftVersionMin,
    info.product.minecraftVersionMax
  );
  const plats = info.product.platforms || [];

  // Shared product card
  const productCard = (
    <div className="flex gap-4 items-start p-4 bg-slate-50 rounded-lg">
      {info.product.coverImage ? (
        <img
          src={info.product.coverImage}
          alt={info.product.name}
          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
          <Package className="h-8 w-8 text-slate-400" />
        </div>
      )}
      <div className="min-w-0">
        <Badge variant="secondary" className="mb-1 text-xs">
          {categoryLabels[info.product.category] || info.product.category}
        </Badge>
        <h2 className="font-bold text-lg leading-tight">{info.product.name}</h2>
        {info.product.shortDescription && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {info.product.shortDescription}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mt-2">
          {vLabel && (
            <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
              MC {vLabel}
            </span>
          )}
          {plats.map((p) => (
            <span key={p} className="text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  // ── PENDING PAYMENT STATE ──────────────────────────
  if (info.pendingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50 p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CreditCard className="h-6 w-6 text-amber-600" />
              <CardTitle className="text-xl">Pago pendiente</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Completa el pago para activar tu producto
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            {productCard}

            {/* Price */}
            <div className="text-center">
              <span className="text-3xl font-extrabold">${info.amount}</span>
              <span className="text-muted-foreground ml-1">{info.currency}</span>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-sm font-bold flex-shrink-0">1</div>
                <div>
                  <p className="font-semibold text-sm text-amber-900">Paga la factura</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {info.paymentUrl
                      ? "Haz click en el boton de abajo para pagar con PayPal."
                      : "Realiza el pago usando el metodo indicado por el vendedor."}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-white text-sm font-bold flex-shrink-0">2</div>
                <div>
                  <p className="font-semibold text-sm text-slate-600">Espera confirmacion</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Una vez que se confirme tu pago, esta pagina se actualizara automaticamente.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-white text-sm font-bold flex-shrink-0">3</div>
                <div>
                  <p className="font-semibold text-sm text-slate-600">Descarga tu producto</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Acepta los terminos y descarga tu archivo inmediatamente.
                  </p>
                </div>
              </div>
            </div>

            {/* Pay button */}
            {info.paymentUrl ? (
              <a href={info.paymentUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-2 h-12 text-base font-semibold bg-[#0070ba] hover:bg-[#005ea6]" size="lg">
                  <CreditCard className="h-5 w-5" />
                  Pagar factura con PayPal
                  <ExternalLink className="h-4 w-4 ml-1" />
                </Button>
              </a>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-medium">Metodo de pago: {info.paymentMethod === "paypal_invoice" ? "Factura PayPal" : info.paymentMethod}</p>
                <p className="text-blue-700 mt-1">Contacta al vendedor para obtener instrucciones de pago.</p>
              </div>
            )}

            {/* Polling indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-amber-600">
              <Clock className="h-3.5 w-3.5 animate-pulse" />
              <span>Esperando confirmacion de pago... esta pagina se actualiza automaticamente.</span>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              <p>Enlace valido hasta: {new Date(info.expiresAt).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── NORMAL REDEEM FORM ──────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Package className="h-6 w-6 text-indigo-600" />
            <CardTitle className="text-xl">Activar compra</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Producto digital — entrega instantánea
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          {productCard}

          {/* Price */}
          <div className="text-center">
            <span className="text-3xl font-extrabold">${info.amount}</span>
            <span className="text-muted-foreground ml-1">{info.currency}</span>
          </div>

          {/* Buyer name (optional) */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              Nombre completo (opcional)
            </label>
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Tu nombre legal"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se usará en la licencia y factura.
            </p>
          </div>

          {/* Terms acceptance */}
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                setError("");
              }}
              className="rounded mt-0.5"
            />
            <span className="text-sm">
              Acepto los{" "}
              <a href="/terms" target="_blank" className="text-indigo-600 hover:underline">
                términos y condiciones
              </a>{" "}
              y la{" "}
              <a href="/privacy" target="_blank" className="text-indigo-600 hover:underline">
                política de privacidad
              </a>
              .
            </span>
          </label>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Confirm button */}
          <Button
            className="w-full gap-2 h-12 text-base font-semibold"
            size="lg"
            onClick={handleConfirm}
            disabled={confirming || !termsAccepted}
          >
            {confirming ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
            Activar y descargar
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            <p>Enlace válido hasta: {new Date(info.expiresAt).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
