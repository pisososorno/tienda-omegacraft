"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle, Download, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ReturnStatus = "capturing" | "success" | "error";

interface CaptureResult {
  orderNumber: string;
  downloadUrl: string;
  licenseKey: string;
}

export default function CheckoutReturnPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ReturnStatus>("capturing");
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState("");
  const pendingRef = useRef<{ orderId: string; email: string } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("pendingOrder");
    if (!raw) {
      setError("No pending order found. Please start checkout again.");
      setStatus("error");
      return;
    }

    const pending = JSON.parse(raw);
    pendingRef.current = { orderId: pending.orderId, email: pending.email };
    sessionStorage.removeItem("pendingOrder");

    fetch("/api/checkout/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: pending.orderId,
        paypalOrderId: pending.paypalOrderId,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Capture failed");
        setResult({
          orderNumber: data.orderNumber,
          downloadUrl: data.downloadUrl,
          licenseKey: data.licenseKey,
        });
        setStatus("success");
        // Track checkout success viewed (fire-and-forget)
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: pending.orderId,
            email: pending.email,
            eventType: "checkout.success_viewed",
          }),
        }).catch(() => {});
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  return (
    <div className="container py-12 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>
            {status === "capturing" && "Processing Payment..."}
            {status === "success" && "Payment Successful!"}
            {status === "error" && "Payment Error"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status === "capturing" && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">
                Confirming your payment with PayPal...
              </p>
              <p className="text-xs text-muted-foreground">
                Please do not close this window.
              </p>
            </div>
          )}

          {status === "success" && result && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-semibold">Thank you for your purchase!</p>
                <p className="text-sm text-muted-foreground">
                  Order {result.orderNumber}
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-green-600" />
                  <span>A download link has been sent to your email.</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4 text-green-600" />
                  <span>You can also download directly below.</span>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium">License Key:</span>{" "}
                  <code className="bg-muted px-2 py-0.5 rounded text-xs">
                    {result.licenseKey}
                  </code>
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={() => {
                    // Track download.button_clicked (fire-and-forget)
                    if (pendingRef.current) {
                      fetch("/api/track", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          orderId: pendingRef.current.orderId,
                          email: pendingRef.current.email,
                          eventType: "download.button_clicked",
                          extra: { source: "checkout_success_page" },
                        }),
                      }).catch(() => {});
                    }
                    window.location.href = result.downloadUrl;
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download Now
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push("/my-downloads")}
                >
                  Go to My Downloads
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <p className="text-lg font-semibold">Something went wrong</p>
              </div>
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">
                {error}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/catalog")}
              >
                Return to catalog
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
