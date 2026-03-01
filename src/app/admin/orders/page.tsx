"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Eye, Shield, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OrderRow {
  id: string;
  orderNumber: string;
  buyerEmail: string;
  productName: string;
  productCategory: string;
  amountUsd: string;
  status: string;
  downloadCount: number;
  downloadLimit: number;
  evidenceFrozenAt: string | null;
  createdAt: string;
  eventCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  function fetchOrders(page = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/admin/orders?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchOrders(1);
  }

  async function handleDeleteOrder(id: string, orderNumber: string) {
    if (!confirm(`ELIMINAR orden ${orderNumber} permanentemente?\n\nSe eliminaran todos los registros asociados (eventos, licencia, tokens, snapshots, delivery stages).\n\nEsta accion NO se puede deshacer.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al eliminar");
      }
      fetchOrders(pagination.page);
    } catch {
      alert("Error de red al eliminar");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <span className="text-sm text-muted-foreground">
          {pagination.total} total
        </span>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <Input
                placeholder="Search by order number, email, or PayPal ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button type="submit" variant="secondary" className="gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </form>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="confirmed">Confirmed</option>
              <option value="disputed">Disputed</option>
              <option value="frozen">Frozen</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Order</th>
                  <th className="text-left p-3 font-medium">Buyer</th>
                  <th className="text-left p-3 font-medium">Product</th>
                  <th className="text-left p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Downloads</th>
                  <th className="text-left p-3 font-medium">Events</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{order.orderNumber}</td>
                      <td className="p-3 truncate max-w-[200px]">{order.buyerEmail}</td>
                      <td className="p-3 truncate max-w-[200px]">{order.productName}</td>
                      <td className="p-3 font-medium">${order.amountUsd}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className={statusColors[order.status] || ""}>
                            {order.status}
                          </Badge>
                          {order.evidenceFrozenAt && <Shield className="h-3.5 w-3.5 text-blue-600" />}
                          {order.status === "disputed" && <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {order.downloadCount}/{order.downloadLimit}
                      </td>
                      <td className="p-3 text-muted-foreground">{order.eventCount}</td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/orders/${order.id}`}>
                            <Button variant="ghost" size="sm" className="gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Eliminar orden"
                            disabled={deleting === order.id}
                            onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                          >
                            {deleting === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchOrders(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchOrders(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
