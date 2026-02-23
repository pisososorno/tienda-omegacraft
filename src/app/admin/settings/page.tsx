"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save, Loader2, ExternalLink, Shield, CreditCard, Globe,
  Palette, RotateCcw, Check, Sparkles, Upload, X, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface AppearanceForm {
  primaryColor: string;
  accentColor: string;
  navbarBg: string;
  navbarText: string;
  heroBgType: "gradient" | "solid" | "image";
  heroBgGradient: string;
  heroBgSolid: string;
  heroBgImage: string;
  bodyBg: string;
  cardBg: string;
  footerBg: string;
  footerText: string;
  catalogBg: string;
}

const DEFAULT_APPEARANCE: AppearanceForm = {
  primaryColor: "#6366f1",
  accentColor: "#818cf8",
  navbarBg: "#ffffff",
  navbarText: "#0f172a",
  heroBgType: "gradient",
  heroBgGradient: "from-slate-900 via-indigo-950 to-slate-900",
  heroBgSolid: "#0f172a",
  heroBgImage: "",
  bodyBg: "#ffffff",
  cardBg: "#ffffff",
  footerBg: "#0f172a",
  footerText: "#f8fafc",
  catalogBg: "#f8fafc",
};

function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded border cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs flex-1"
          placeholder="#000000"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [form, setForm] = useState({
    storeName: "TiendaDigital",
    storeSlogan: "Productos digitales premium para Minecraft",
    contactEmail: "support@tiendadigital.com",
    privacyEmail: "privacy@tiendadigital.com",
    heroTitle: "Plugins, Maps y Configs de calidad profesional",
    heroDescription: "Descubre nuestra colecci\u00f3n de productos digitales para Minecraft. Spawns, dungeons, plugins y source code \u2014 todo con entrega instant\u00e1nea y soporte incluido.",
    paypalClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
    paypalMode: "sandbox",
  });

  const [appearance, setAppearance] = useState<AppearanceForm>(DEFAULT_APPEARANCE);

  // Load settings from DB on mount
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setForm((f) => ({
          ...f,
          storeName: data.storeName || f.storeName,
          storeSlogan: data.storeSlogan || f.storeSlogan,
          contactEmail: data.contactEmail || f.contactEmail,
          privacyEmail: data.privacyEmail || f.privacyEmail,
          heroTitle: data.heroTitle || f.heroTitle,
          heroDescription: data.heroDescription || f.heroDescription,
        }));
        if (data.logoUrl !== undefined) setLogoUrl(data.logoUrl);
        if (data.appearance) {
          setAppearance((a) => ({ ...a, ...data.appearance }));
        }
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function updateField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
    setError("");
  }

  function updateAppearance(field: keyof AppearanceForm, value: string) {
    setAppearance((a) => ({ ...a, [field]: value }));
    setSaved(false);
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: form.storeName,
          logoUrl,
          storeSlogan: form.storeSlogan,
          contactEmail: form.contactEmail,
          privacyEmail: form.privacyEmail,
          heroTitle: form.heroTitle,
          heroDescription: form.heroDescription,
          appearance,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al guardar");
        return;
      }

      setSaved(true);
    } catch {
      setError("Error de conexion. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  function resetAppearance() {
    setAppearance(DEFAULT_APPEARANCE);
    setSaved(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configuracion</h1>
        <p className="text-muted-foreground text-sm">Configuracion de la tienda, apariencia y pagos</p>
      </div>

      <form onSubmit={handleSave}>
        <div className="space-y-6">
          {/* ── GENERAL ─────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">General</CardTitle>
                  <CardDescription>Configuracion general de la tienda</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre de la tienda</label>
                <Input
                  value={form.storeName}
                  onChange={(e) => updateField("storeName", e.target.value)}
                  placeholder="TiendaDigital"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Se muestra en el navbar, footer, emails, PDF y toda la web.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Logo de la tienda</label>
                {logoUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="relative w-32 h-16 rounded-lg border overflow-hidden bg-muted flex items-center justify-center">
                      <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{logoUrl}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive gap-1 h-7 text-xs w-fit"
                        onClick={() => { setLogoUrl(null); setSaved(false); }}
                      >
                        <X className="h-3 w-3" /> Quitar logo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-full h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 bg-muted/30 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingLogo(true);
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                          const data = await res.json();
                          if (res.ok && data.url) {
                            setLogoUrl(data.url);
                            setSaved(false);
                          } else {
                            setError(data.error || "Error subiendo logo");
                          }
                        } catch {
                          setError("Error subiendo logo");
                        } finally {
                          setUploadingLogo(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    {uploadingLogo ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="h-5 w-5" />
                        <span className="text-xs">Subir logo (PNG, JPG, WebP, SVG — max 5MB)</span>
                      </div>
                    )}
                  </label>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Se muestra en el navbar y footer. Recomendado: fondo transparente, max 200×60px. Si no hay logo, se usa el icono + nombre.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Eslogan</label>
                <Input
                  value={form.storeSlogan}
                  onChange={(e) => updateField("storeSlogan", e.target.value)}
                  placeholder="Productos digitales premium para Minecraft"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Email de soporte</label>
                  <Input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => updateField("contactEmail", e.target.value)}
                    placeholder="support@tiendadigital.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email de privacidad</label>
                  <Input
                    type="email"
                    value={form.privacyEmail}
                    onChange={(e) => updateField("privacyEmail", e.target.value)}
                    placeholder="privacy@tiendadigital.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── HERO (Pagina de inicio) ──────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Pagina de inicio (Hero)</CardTitle>
                  <CardDescription>Textos principales que aparecen en el banner de la pagina de inicio</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Titulo principal</label>
                <Input
                  value={form.heroTitle}
                  onChange={(e) => updateField("heroTitle", e.target.value)}
                  placeholder="Plugins, Maps y Configs de calidad profesional"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Texto grande del hero. Se muestra en la parte superior de la pagina de inicio.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descripcion</label>
                <textarea
                  value={form.heroDescription}
                  onChange={(e) => updateField("heroDescription", e.target.value)}
                  placeholder="Descubre nuestra coleccion de productos digitales..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Parrafo debajo del titulo. Describe tu tienda en 1-2 lineas.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">Vista previa del hero:</p>
                <div className="bg-slate-900 rounded-lg p-6 text-center">
                  <span className="inline-block bg-white/10 text-white/80 text-xs px-3 py-1 rounded-full mb-3">{form.storeSlogan}</span>
                  <h2 className="text-lg font-extrabold text-white mb-2">{form.heroTitle || "Titulo principal"}</h2>
                  <p className="text-xs text-white/60 max-w-md mx-auto">{form.heroDescription || "Descripcion de la tienda"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── APARIENCIA ──────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">Apariencia</CardTitle>
                    <CardDescription>Colores y fondos de la tienda</CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetAppearance}
                  className="text-xs gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restaurar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Colores principales */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-slate-700">Colores principales</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ColorField
                    label="Color primario"
                    value={appearance.primaryColor}
                    onChange={(v) => updateAppearance("primaryColor", v)}
                    hint="Botones, links, acentos"
                  />
                  <ColorField
                    label="Color de acento"
                    value={appearance.accentColor}
                    onChange={(v) => updateAppearance("accentColor", v)}
                    hint="Hover, detalles secundarios"
                  />
                </div>
              </div>

              {/* Navbar */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-slate-700">Barra de navegacion</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ColorField
                    label="Fondo del navbar"
                    value={appearance.navbarBg}
                    onChange={(v) => updateAppearance("navbarBg", v)}
                  />
                  <ColorField
                    label="Texto del navbar"
                    value={appearance.navbarText}
                    onChange={(v) => updateAppearance("navbarText", v)}
                  />
                </div>
              </div>

              {/* Hero / Home */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-slate-700">Seccion Hero (Pagina de inicio)</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tipo de fondo</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={appearance.heroBgType}
                      onChange={(e) => updateAppearance("heroBgType", e.target.value)}
                    >
                      <option value="gradient">Gradiente (CSS Tailwind)</option>
                      <option value="solid">Color solido</option>
                      <option value="image">Imagen de fondo</option>
                    </select>
                  </div>

                  {appearance.heroBgType === "gradient" && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">Clases de gradiente</label>
                      <Input
                        value={appearance.heroBgGradient}
                        onChange={(e) => updateAppearance("heroBgGradient", e.target.value)}
                        placeholder="from-slate-900 via-indigo-950 to-slate-900"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Clases Tailwind de gradiente. Ejemplo: <code>from-purple-900 via-blue-900 to-slate-900</code>
                      </p>
                    </div>
                  )}

                  {appearance.heroBgType === "solid" && (
                    <ColorField
                      label="Color de fondo"
                      value={appearance.heroBgSolid}
                      onChange={(v) => updateAppearance("heroBgSolid", v)}
                    />
                  )}

                  {appearance.heroBgType === "image" && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">URL de imagen de fondo</label>
                      <Input
                        value={appearance.heroBgImage}
                        onChange={(e) => updateAppearance("heroBgImage", e.target.value)}
                        placeholder="https://example.com/hero-bg.jpg"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        URL completa de la imagen. Recomendado: 1920x800px minimo.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Body & Cards */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-slate-700">Cuerpo y tarjetas</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ColorField
                    label="Fondo general"
                    value={appearance.bodyBg}
                    onChange={(v) => updateAppearance("bodyBg", v)}
                  />
                  <ColorField
                    label="Fondo catalogo"
                    value={appearance.catalogBg}
                    onChange={(v) => updateAppearance("catalogBg", v)}
                  />
                  <ColorField
                    label="Fondo tarjetas"
                    value={appearance.cardBg}
                    onChange={(v) => updateAppearance("cardBg", v)}
                  />
                </div>
              </div>

              {/* Footer */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-slate-700">Footer</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ColorField
                    label="Fondo del footer"
                    value={appearance.footerBg}
                    onChange={(v) => updateAppearance("footerBg", v)}
                  />
                  <ColorField
                    label="Texto del footer"
                    value={appearance.footerText}
                    onChange={(v) => updateAppearance("footerText", v)}
                  />
                </div>
              </div>

              {/* Preview */}
              <div>
                <h4 className="text-sm font-semibold mb-3 text-slate-700">Vista previa</h4>
                <div className="rounded-lg border overflow-hidden">
                  {/* Mini navbar preview */}
                  <div
                    className="px-4 py-2 flex items-center justify-between text-xs"
                    style={{ backgroundColor: appearance.navbarBg, color: appearance.navbarText }}
                  >
                    <span className="font-bold">{form.storeName}</span>
                    <div className="flex gap-3 opacity-60">
                      <span>Catalogo</span>
                      <span>Descargas</span>
                    </div>
                  </div>
                  {/* Mini hero preview */}
                  <div
                    className="px-4 py-6 text-center text-white text-xs"
                    style={{
                      backgroundColor:
                        appearance.heroBgType === "solid"
                          ? appearance.heroBgSolid
                          : appearance.heroBgType === "image"
                            ? "#1e1b4b"
                            : "#1e1b4b",
                      backgroundImage:
                        appearance.heroBgType === "image" && appearance.heroBgImage
                          ? `url(${appearance.heroBgImage})`
                          : undefined,
                      backgroundSize: "cover",
                    }}
                  >
                    <p className="font-bold">{form.storeName}</p>
                    <p className="opacity-70 mt-1">{form.storeSlogan}</p>
                  </div>
                  {/* Mini body preview */}
                  <div
                    className="px-4 py-3 flex gap-2"
                    style={{ backgroundColor: appearance.catalogBg }}
                  >
                    <div className="flex-1 rounded p-2 text-xs border" style={{ backgroundColor: appearance.cardBg }}>
                      Producto 1
                    </div>
                    <div className="flex-1 rounded p-2 text-xs border" style={{ backgroundColor: appearance.cardBg }}>
                      Producto 2
                    </div>
                  </div>
                  {/* Mini footer preview */}
                  <div
                    className="px-4 py-2 text-xs"
                    style={{ backgroundColor: appearance.footerBg, color: appearance.footerText }}
                  >
                    <span className="opacity-60">&copy; 2026 {form.storeName}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── PAYPAL ──────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">PayPal</CardTitle>
                  <CardDescription>Configura tus credenciales de PayPal para recibir pagos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
                <p className="font-medium text-blue-800">Como configurar PayPal:</p>
                <ol className="list-decimal ml-4 text-blue-700 space-y-1">
                  <li>
                    Ir a{" "}
                    <a href="https://developer.paypal.com/dashboard/" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                      developer.paypal.com/dashboard
                    </a>
                  </li>
                  <li>Crear una app en &quot;Apps & Credentials&quot;</li>
                  <li>Copiar el <strong>Client ID</strong> y el <strong>Secret</strong></li>
                  <li>Pegarlos en el archivo <code className="bg-blue-100 px-1 rounded">.env.local</code></li>
                  <li>Para produccion: cambiar <code className="bg-blue-100 px-1 rounded">PAYPAL_MODE</code> a <code className="bg-blue-100 px-1 rounded">live</code></li>
                </ol>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">PayPal Client ID</label>
                <Input
                  value={form.paypalClientId}
                  onChange={(e) => updateField("paypalClientId", e.target.value)}
                  placeholder="AWxxxxx...tu_client_id_de_paypal"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">Se obtiene del dashboard de PayPal Developer</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Modo</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.paypalMode}
                  onChange={(e) => updateField("paypalMode", e.target.value)}
                >
                  <option value="sandbox">Sandbox (pruebas)</option>
                  <option value="live">Live (produccion)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Usa Sandbox para testear sin dinero real. Cambia a Live cuando estes listo.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                <p className="font-medium text-amber-800">Variables de entorno requeridas en <code>.env.local</code>:</p>
                <pre className="mt-2 bg-amber-100/50 p-3 rounded text-xs font-mono text-amber-900 overflow-x-auto">{`PAYPAL_CLIENT_ID=tu_client_id_aqui
PAYPAL_CLIENT_SECRET=tu_secret_aqui
PAYPAL_WEBHOOK_ID=tu_webhook_id_aqui
PAYPAL_MODE=sandbox`}</pre>
                <p className="mt-2 text-amber-700">
                  Cuando un cliente paga, el dinero va <strong>directo a tu cuenta PayPal</strong>.
                  PayPal Orders API v2 procesa el cobro y lo deposita en tu cuenta de negocio.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── SERVIDOR / ENV ────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Configuracion del servidor</CardTitle>
                  <CardDescription>Variables de entorno en <code>.env.local</code> (no editables desde aqui por seguridad)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* APP */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Aplicacion</h4>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">APP_URL</span><span className="font-mono text-xs">URL publica del sitio</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">DATABASE_URL</span><span className="font-mono text-xs">••••••••••••</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">NEXTAUTH_SECRET</span><span className="font-mono text-xs">••••••••••••</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">NEXTAUTH_URL</span><span className="font-mono text-xs">Misma que APP_URL</span></div>
                </div>
              </div>

              {/* Seguridad */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Seguridad y cifrado</h4>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">DOWNLOAD_SECRET</span><span className="font-mono text-xs">••••••••••••</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">IP_ENCRYPTION_KEY</span><span className="font-mono text-xs">••••••••••••</span></div>
                </div>
              </div>

              {/* SMTP */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email (SMTP)</h4>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">SMTP_HOST</span><span className="font-mono text-xs">Servidor SMTP</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SMTP_PORT</span><span className="font-mono text-xs">587 o 465</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SMTP_USER</span><span className="font-mono text-xs">••••••••••••</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SMTP_PASS</span><span className="font-mono text-xs">••••••••••••</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">FROM_EMAIL</span><span className="font-mono text-xs">noreply@tudominio.com</span></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Necesario para enviar correos de compra y liberacion de etapas. Puedes usar Gmail, Resend, Mailgun, etc.
                </p>
              </div>

              {/* Storage */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Almacenamiento (S3/R2)</h4>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">S3_ENDPOINT</span><span className="font-mono text-xs">URL del endpoint</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">S3_BUCKET</span><span className="font-mono text-xs">Nombre del bucket</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">S3_ACCESS_KEY_ID</span><span className="font-mono text-xs">••••••••••••</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">S3_SECRET_ACCESS_KEY</span><span className="font-mono text-xs">••••••••••••</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">S3_REGION</span><span className="font-mono text-xs">auto (para R2)</span></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Donde se guardan los archivos de productos y PDFs de evidencia. Compatible con Cloudflare R2, AWS S3, MinIO, etc.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-medium text-blue-800 mb-1">Archivo de referencia:</p>
                <p>Copia <code className="bg-blue-100 px-1 rounded">.env.example</code> a <code className="bg-blue-100 px-1 rounded">.env.local</code> y completa todos los valores antes de iniciar el servidor en produccion.</p>
              </div>
            </CardContent>
          </Card>

          {/* ── MENSAJES ────────────────────────── */}
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {saved && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-md text-sm flex items-center gap-2">
              <Check className="h-4 w-4" />
              Configuracion guardada en base de datos. Los cambios se reflejan en toda la web al recargar.
            </div>
          )}

          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar configuracion
          </Button>
        </div>
      </form>

      <div className="mt-8 border-t pt-6">
        <h3 className="font-medium mb-3">Enlaces utiles</h3>
        <div className="space-y-2 text-sm">
          <a href="https://developer.paypal.com/dashboard/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> PayPal Developer Dashboard
          </a>
          <a href="https://developer.paypal.com/tools/sandbox/accounts/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> PayPal Sandbox Accounts
          </a>
          <a href="https://www.paypal.com/businessmanage/account/aboutBusiness" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> PayPal Business Settings
          </a>
        </div>
      </div>
    </div>
  );
}
