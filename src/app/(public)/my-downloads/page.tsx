"use client";

import { useState } from "react";
import { Search, Download, Loader2, Package, Clock, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface OrderResult {
  id: string;
  orderNumber: string;
  productName: string;
  status: string;
  downloadCount: number;
  downloadLimit: number;
  downloadsExpireAt: string | null;
  createdAt: string;
  stages?: Array<{
    id: string;
    stageType: string;
    stageOrder: number;
    status: string;
    filename: string | null;
    downloadCount: number;
    downloadLimit: number;
  }>;
}

const statusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  confirmed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  refunded: "bg-red-100 text-red-800",
  disputed: "bg-orange-100 text-orange-800",
  frozen: "bg-blue-100 text-blue-800",
};

export default function MyDownloadsPage() {
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orders, setOrders] = useState<OrderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    if (!email && !orderNumber) return;
    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const params = new URLSearchParams();
      if (email) params.set("email", email);
      if (orderNumber) params.set("orderNumber", orderNumber);

      const res = await fetch(`/api/my-downloads?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Search failed");
        setOrders([]);
      } else {
        const found = data.orders || [];
        setOrders(found);
        // Track page viewed for each order (fire-and-forget)
        for (const o of found) {
          fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: o.id,
              email,
              eventType: "downloads.page_viewed",
            }),
          }).catch(() => {});
        }
      }
    } catch {
      setError("Network error");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function requestNewToken(orderId: string, stageId?: string) {
    // Track button click (fire-and-forget)
    if (email) {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          email,
          eventType: "download.button_clicked",
          extra: { stageId: stageId || null },
        }),
      }).catch(() => {});
    }
    try {
      const res = await fetch("/api/my-downloads/new-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email, stageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to generate download link");
        return;
      }
      window.open(data.downloadUrl, "_blank");
    } catch {
      alert("Network error");
    }
  }

  return (
    <div className="container py-12 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">My Downloads</h1>
        <p className="text-muted-foreground">
          Enter your email or order number to access your purchases.
        </p>
      </div>

      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="dl-email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="dl-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="dl-order" className="text-sm font-medium">
                  Order Number
                </label>
                <Input
                  id="dl-order"
                  placeholder="ORD-XXXXXX"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleSearch}
              disabled={loading || (!email && !orderNumber)}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search Orders
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm mb-6">
          {error}
        </div>
      )}

      {searched && !loading && orders.length === 0 && !error && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No orders found.</p>
        </div>
      )}

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{order.productName}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {order.orderNumber} &middot;{" "}
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={statusColors[order.status] || ""}
                >
                  {order.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Download className="h-3.5 w-3.5" />
                  {order.downloadCount}/{order.downloadLimit} downloads
                </span>
                {order.downloadsExpireAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Expires{" "}
                    {new Date(order.downloadsExpireAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Staged delivery */}
              {order.stages && order.stages.length > 0 ? (
                <div className="space-y-2">
                  {order.stages.map((stage) => (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between bg-muted/50 rounded-lg p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          Stage {stage.stageOrder}:{" "}
                          {stage.stageType === "preview"
                            ? "Preview/Demo"
                            : "Full Source"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stage.filename || "—"} &middot;{" "}
                          {stage.downloadCount}/{stage.downloadLimit} downloads
                        </p>
                      </div>
                      {stage.status === "ready" || stage.status === "delivered" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={
                            order.status === "frozen" ||
                            stage.downloadCount >= stage.downloadLimit
                          }
                          onClick={() => requestNewToken(order.id, stage.id)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </Button>
                      ) : (
                        <Badge variant="outline">
                          {stage.status === "pending" ? "Pending release" : stage.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={
                    order.status === "frozen" ||
                    order.status === "refunded" ||
                    order.downloadCount >= order.downloadLimit
                  }
                  onClick={() => requestNewToken(order.id)}
                >
                  <Download className="h-4 w-4" />
                  Request Download Link
                </Button>
              )}

              {order.status === "frozen" && (
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-lg">
                  <Shield className="h-4 w-4" />
                  This order is under review. Downloads are temporarily suspended.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
