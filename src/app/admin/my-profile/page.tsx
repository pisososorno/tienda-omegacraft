"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Save,
  Package,
  ShoppingCart,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SellerProfileData {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-orange-100 text-orange-700",
  disabled: "bg-red-100 text-red-700",
};

const STATUS_MESSAGES: Record<string, string> = {
  active: "Tu cuenta de seller está activa. Puedes crear y publicar productos.",
  pending: "Tu cuenta está pendiente de aprobación. Puedes crear productos como borrador pero no publicarlos.",
  suspended: "Tu cuenta está suspendida. No puedes crear ni editar productos. Contacta al administrador.",
  disabled: "Tu cuenta está deshabilitada. Contacta al administrador.",
};

export default function MyProfilePage() {
  const [profile, setProfile] = useState<SellerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [notSeller, setNotSeller] = useState(false);

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");

  async function fetchProfile() {
    try {
      const res = await fetch("/api/admin/seller/profile");
      if (res.status === 400) {
        setNotSeller(true);
        return;
      }
      if (res.status === 404) {
        setError("No tienes perfil de seller. Contacta al administrador para que te asigne uno.");
        return;
      }
      if (!res.ok) throw new Error("Error al cargar perfil");
      const data = await res.json();
      setProfile(data);
      setDisplayName(data.displayName);
      setPayoutEmail(data.payoutEmail || "");
      setPayoutMethod(data.payoutMethod || "");
    } catch {
      setError("Error al cargar perfil de seller");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/seller/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          payoutEmail: payoutEmail || null,
          payoutMethod: payoutMethod || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      setSuccess("Perfil actualizado correctamente");
      fetchProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notSeller) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <User className="h-12 w-12 mb-4 opacity-30" />
        <p>Esta página es solo para cuentas de tipo Seller.</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  const canEdit = profile.status === "active" || profile.status === "pending";
  const allowedCategories = [
    profile.canSellPlugins && "Plugins",
    profile.canSellMaps && "Maps",
    profile.canSellConfigurations && "Configuraciones",
    profile.canSellSourceCode && "Source Code",
  ].filter(Boolean);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Mi Perfil de Seller</h1>
        <p className="text-muted-foreground text-sm">
          Gestiona tu información de vendedor
        </p>
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

      {/* Status banner */}
      <div className={`p-4 rounded-md border ${
        profile.status === "active" ? "bg-emerald-50 border-emerald-200" :
        profile.status === "pending" ? "bg-amber-50 border-amber-200" :
        "bg-red-50 border-red-200"
      }`}>
        <div className="flex items-center gap-3">
          <Badge className={`${STATUS_COLORS[profile.status] || ""}`}>
            {profile.status.toUpperCase()}
          </Badge>
          <span className="text-sm">{STATUS_MESSAGES[profile.status] || ""}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{profile.productCount}</div>
            <div className="text-xs text-muted-foreground">Productos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{(parseFloat(profile.commissionRate) * 100).toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">Comisión</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <ShoppingCart className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{profile.holdDays}</div>
            <div className="text-xs text-muted-foreground">Hold Days</div>
          </CardContent>
        </Card>
      </div>

      {/* Allowed categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorías permitidas</CardTitle>
        </CardHeader>
        <CardContent>
          {allowedCategories.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {allowedCategories.map((cat) => (
                <Badge key={cat as string} variant="outline" className="text-sm">
                  {cat}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tienes categorías asignadas. Contacta al administrador.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información editable</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre de display</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                disabled={!canEdit}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email de pago</label>
              <input
                type="email"
                value={payoutEmail}
                onChange={(e) => setPayoutEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="paypal@email.com"
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Método de pago preferido</label>
              <input
                type="text"
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="PayPal, transferencia, etc."
                disabled={!canEdit}
              />
            </div>

            {canEdit && (
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar cambios
              </Button>
            )}

            {!canEdit && (
              <p className="text-sm text-muted-foreground">
                No puedes editar tu perfil mientras tu cuenta esté {profile.status}.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Miembro desde: {new Date(profile.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}
