"use client";

import { useEffect, useState } from "react";
import {
  Store,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Package,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SellerProfile {
  id: string;
  userId: string;
  displayName: string;
  payoutEmail: string | null;
  payoutMethod: string | null;
  status: string;
  canSellPlugins: boolean;
  canSellMaps: boolean;
  canSellConfigurations: boolean;
  canSellSourceCode: boolean;
  commissionRate: string;
  holdDays: number;
  reserveRate: string;
  productCount: number;
  totalOrders: number;
  totalRevenue: string;
  userEmail: string;
  userName: string;
  userDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-orange-100 text-orange-700",
  disabled: "bg-red-100 text-red-700",
};

const CATEGORIES = [
  { key: "canSellPlugins", label: "Plugins" },
  { key: "canSellMaps", label: "Maps" },
  { key: "canSellConfigurations", label: "Configs" },
  { key: "canSellSourceCode", label: "Source Code" },
] as const;

export default function SellersPage() {
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [createUserId, setCreateUserId] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createPayoutEmail, setCreatePayoutEmail] = useState("");
  const [createCategories, setCreateCategories] = useState({
    canSellPlugins: false,
    canSellMaps: false,
    canSellConfigurations: false,
    canSellSourceCode: false,
  });
  const [creating, setCreating] = useState(false);

  // Edit status
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function fetchSellers() {
    try {
      const res = await fetch("/api/admin/sellers");
      if (!res.ok) throw new Error("Failed to fetch sellers");
      const data = await res.json();
      setSellers(data);
    } catch {
      setError("Error al cargar sellers");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailableUsers() {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setAvailableUsers(data);
    } catch {
      setError("Error al cargar usuarios");
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    fetchSellers();
  }, []);

  function openCreateForm() {
    setShowCreate(true);
    fetchAvailableUsers();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: createUserId,
          displayName: createDisplayName,
          payoutEmail: createPayoutEmail || undefined,
          ...createCategories,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear seller");

      setSuccess("Seller creado exitosamente");
      setShowCreate(false);
      setCreateUserId("");
      setCreateDisplayName("");
      setCreatePayoutEmail("");
      setCreateCategories({
        canSellPlugins: false,
        canSellMaps: false,
        canSellConfigurations: false,
        canSellSourceCode: false,
      });
      fetchSellers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear seller");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(sellerId: string, newStatus: string) {
    setUpdatingId(sellerId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");

      setSuccess(`Estado actualizado a ${newStatus}`);
      fetchSellers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCategoryToggle(sellerId: string, field: string, value: boolean) {
    setUpdatingId(sellerId);
    setError("");

    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error");
      }
      fetchSellers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Users that don't already have a seller profile
  const existingSellerUserIds = sellers.map((s) => s.userId);
  const filteredUsers = availableUsers.filter((u) => !existingSellerUserIds.includes(u.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sellers</h1>
          <p className="text-muted-foreground text-sm">
            Gestionar perfiles de vendedores y permisos
          </p>
        </div>
        <Button onClick={openCreateForm} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Nuevo Seller
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-md text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Create seller form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crear Nuevo Seller</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Usuario</label>
                  {loadingUsers ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <select
                      value={createUserId}
                      onChange={(e) => setCreateUserId(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Seleccionar usuario...</option>
                      {filteredUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email}) — {u.role}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Nombre de display</label>
                  <input
                    type="text"
                    value={createDisplayName}
                    onChange={(e) => setCreateDisplayName(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="Nombre público del seller"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email de pago (opcional)</label>
                  <input
                    type="email"
                    value={createPayoutEmail}
                    onChange={(e) => setCreatePayoutEmail(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="paypal@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Categorías permitidas</label>
                <div className="flex gap-4 flex-wrap">
                  {CATEGORIES.map((cat) => (
                    <label key={cat.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={createCategories[cat.key]}
                        onChange={(e) =>
                          setCreateCategories((prev) => ({
                            ...prev,
                            [cat.key]: e.target.checked,
                          }))
                        }
                        className="rounded"
                      />
                      {cat.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={creating} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear Seller
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sellers list */}
      {sellers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No hay sellers registrados todavía.</p>
            <p className="text-xs mt-1">Usa &quot;Nuevo Seller&quot; para crear el primero.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sellers.map((seller) => (
            <Card key={seller.id} className="overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(expandedId === seller.id ? null : seller.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium">{seller.displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      {seller.userEmail} — {seller.userName}
                    </div>
                  </div>
                  <Badge className={`text-xs ${STATUS_COLORS[seller.status] || "bg-gray-100 text-gray-700"}`}>
                    {seller.status}
                  </Badge>
                  {seller.userDisabled && (
                    <Badge variant="destructive" className="text-xs">
                      Cuenta deshabilitada
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      {seller.productCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      {seller.totalOrders}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      ${seller.totalRevenue}
                    </span>
                  </div>
                  {expandedId === seller.id ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {expandedId === seller.id && (
                <div className="border-t px-4 py-4 bg-muted/10 space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-md bg-background border">
                      <div className="text-2xl font-bold">{seller.productCount}</div>
                      <div className="text-xs text-muted-foreground">Productos</div>
                    </div>
                    <div className="text-center p-3 rounded-md bg-background border">
                      <div className="text-2xl font-bold">{seller.totalOrders}</div>
                      <div className="text-xs text-muted-foreground">Órdenes</div>
                    </div>
                    <div className="text-center p-3 rounded-md bg-background border">
                      <div className="text-2xl font-bold text-emerald-600">${seller.totalRevenue}</div>
                      <div className="text-xs text-muted-foreground">Revenue Total</div>
                    </div>
                    <div className="text-center p-3 rounded-md bg-background border">
                      <div className="text-2xl font-bold">{(parseFloat(seller.commissionRate) * 100).toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">Comisión</div>
                    </div>
                  </div>

                  {/* Categorías */}
                  <div>
                    <div className="text-sm font-medium mb-2">Categorías permitidas</div>
                    <div className="flex gap-3 flex-wrap">
                      {CATEGORIES.map((cat) => {
                        const enabled = seller[cat.key];
                        return (
                          <button
                            key={cat.key}
                            onClick={() => handleCategoryToggle(seller.id, cat.key, !enabled)}
                            disabled={updatingId === seller.id}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              enabled
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                            }`}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Info extra */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Payout email:</span>
                      <div className="font-medium">{seller.payoutEmail || "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Método pago:</span>
                      <div className="font-medium">{seller.payoutMethod || "—"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hold days:</span>
                      <div className="font-medium">{seller.holdDays} días</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Reserve rate:</span>
                      <div className="font-medium">{(parseFloat(seller.reserveRate) * 100).toFixed(0)}%</div>
                    </div>
                  </div>

                  {/* Status actions */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground mr-2">Cambiar estado:</span>
                    {["active", "pending", "suspended", "disabled"].map((s) => (
                      <Button
                        key={s}
                        variant={seller.status === s ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7"
                        disabled={seller.status === s || updatingId === seller.id}
                        onClick={() => handleStatusChange(seller.id, s)}
                      >
                        {updatingId === seller.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          s.charAt(0).toUpperCase() + s.slice(1)
                        )}
                      </Button>
                    ))}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Creado: {new Date(seller.createdAt).toLocaleDateString()} · Actualizado: {new Date(seller.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
