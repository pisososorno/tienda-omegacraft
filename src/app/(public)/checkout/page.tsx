"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Shield, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface ProductInfo {
  id: string;
  slug: string;
  name: string;
  priceUsd: string;
  shortDescription: string | null;
  category: string;
}

type CheckoutStep = "form" | "processing" | "redirect" | "error";

export default function CheckoutPageWrapper() {
  return (
    <Suspense fallback={<div className="container py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>}>
      <CheckoutPage />
    </Suspense>
  );
}

function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productSlug = searchParams.get("product");

  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<CheckoutStep>("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productSlug) return;
    fetch(`/api/products/${productSlug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [productSlug]);

  async function handleCheckout() {
    if (!fullName.trim() || !email || !termsAccepted || !productSlug) return;

    setStep("processing");
    setError("");

    try {
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug,
          buyerName: fullName.trim(),
          buyerEmail: email,
          termsAccepted: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al crear la orden");
        setStep("error");
        return;
      }

      // Store order info for return page
      sessionStorage.setItem(
        "pendingOrder",
        JSON.stringify({
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          paypalOrderId: data.paypalOrderId,
          email,
        })
      );

      // Redirect to PayPal
      setStep("redirect");
      if (data.approveUrl) {
        window.location.href = data.approveUrl;
      } else {
        setError("No se recibió URL de aprobación de PayPal");
        setStep("error");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setStep("error");
    }
  }

  if (!productSlug) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">No se seleccionó un producto</h1>
        <Button variant="outline" onClick={() => router.push("/catalog")}>
          Ver catálogo
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container py-12 max-w-lg mx-auto">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Producto no encontrado</h1>
        <Button variant="outline" onClick={() => router.push("/catalog")}>
          Ver catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-12 max-w-lg mx-auto">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 gap-2"
        onClick={() => router.push(`/catalog/${product.slug}`)}
      >
        <ArrowLeft className="h-4 w-4" /> Volver al producto
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Finalizar compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Order summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-1">
            <p className="font-semibold">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              {product.shortDescription}
            </p>
            <p className="text-2xl font-bold mt-2">${product.priceUsd}</p>
          </div>

          {step === "form" && (
            <>
              {/* Full Name */}
              <div className="space-y-2">
                <label
                  htmlFor="fullName"
                  className="text-sm font-medium"
                >
                  Nombre completo
                </label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Tu nombre completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
                <p className="text-xs text-muted-foreground">
                  Debe coincidir con el titular de la cuenta de PayPal.
                </p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium"
                >
                  Correo electronico
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <p className="text-xs text-muted-foreground">
                  Tu enlace de descarga se enviara a este correo.
                </p>
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(v) => setTermsAccepted(v === true)}
                  className="mt-0.5"
                />
                <label htmlFor="terms" className="text-sm leading-relaxed">
                  Confirmo que soy el titular autorizado de la cuenta de pago, acepto los{" "}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Terminos y Condiciones
                  </a>{" "}
                  y la{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Politica de Privacidad
                  </a>
                  , entiendo que este es un <strong>producto digital con entrega inmediata e irreversible</strong> y que por su naturaleza <strong>no es reembolsable</strong> una vez completada la compra.
                </label>
              </div>

              {/* Pay button */}
              <Button
                className="w-full gap-2"
                size="lg"
                disabled={!fullName.trim() || !email || !termsAccepted}
                onClick={handleCheckout}
              >
                <Shield className="h-4 w-4" />
                Pagar con PayPal — ${product.priceUsd}
              </Button>
            </>
          )}

          {step === "processing" && (
            <div className="text-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                Creando tu orden...
              </p>
            </div>
          )}

          {step === "redirect" && (
            <div className="text-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                Redirigiendo a PayPal...
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-4">
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">
                {error}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep("form")}
              >
                Intentar de nuevo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
