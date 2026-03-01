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
  heroBgImageOpacity: number;
  heroBgImageSize: number;
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
  heroBgImageOpacity: 40,
  heroBgImageSize: 100,
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
  const [logoHeight, setLogoHeight] = useState(32);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHeroBg, setUploadingHeroBg] = useState(false);

  const [form, setForm] = useState({
    storeName: "TiendaDigital",
    storeSlogan: "Productos digitales premium para Minecraft",
    contactEmail: "support@tiendadigital.com",
    privacyEmail: "privacy@tiendadigital.com",
    heroTitle: "Plugins, Maps y Configs de calidad profesional",
    heroDescription: "Descubre nuestra colecci\u00f3n de productos digitales para Minecraft. Spawns, dungeons, plugins y source code \u2014 todo con entrega instant\u00e1nea y soporte incluido.",
  });

  const [paypalStatus, setPaypalStatus] = useState<{
    clientIdConfigured: boolean;
    clientIdMasked: string;
    secretConfigured: boolean;
    webhookIdConfigured: boolean;
    mode: string;
    sandbox?: { clientIdConfigured: boolean; secretConfigured: boolean; webhookIdConfigured: boolean };
    live?: { clientIdConfigured: boolean; secretConfigured: boolean; webhookIdConfigured: boolean };
  } | null>(null);
  const [togglingMode, setTogglingMode] = useState(false);
  const [modeError, setModeError] = useState("");

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
          if (data.appearance.logoHeight) setLogoHeight(data.appearance.logoHeight);
        }
        if (data.paypal) setPaypalStatus(data.paypal);
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

  function updateAppearance(field: keyof AppearanceForm, value: string | number) {
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
          appearance: { ...appearance, logoHeight },
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
              {logoUrl && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Tamaño del logo (altura en px)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="20"
                      max="80"
                      value={logoHeight}
                      onChange={(e) => { setLogoHeight(parseInt(e.target.value)); setSaved(false); }}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12 text-center">{logoHeight}px</span>
                  </div>
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 border flex items-center gap-3">
                    <img src={logoUrl} alt="Preview" style={{ height: `${logoHeight}px` }} className="object-contain" />
                    <span className="text-xs text-muted-foreground">Vista previa del tamaño</span>
                  </div>
                </div>
              )}
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
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Imagen de fondo del hero</label>
                        {appearance.heroBgImage ? (
                          <div className="space-y-2">
                            <div className="relative rounded-lg overflow-hidden border h-32 bg-slate-900">
                              <img
                                src={appearance.heroBgImage}
                                alt="Hero BG"
                                className="w-full h-full object-cover"
                                style={{
                                  opacity: (appearance.heroBgImageOpacity ?? 40) / 100,
                                  transform: `scale(${(appearance.heroBgImageSize ?? 100) / 100})`,
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground truncate flex-1">{appearance.heroBgImage}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive gap-1 h-7 text-xs"
                                onClick={() => { updateAppearance("heroBgImage", ""); }}
                              >
                                <X className="h-3 w-3" /> Quitar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center w-full h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 bg-muted/30 cursor-pointer transition-colors">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingHeroBg(true);
                                try {
                                  const fd = new FormData();
                                  fd.append("file", file);
                                  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                                  const data = await res.json();
                                  if (res.ok && data.url) {
                                    updateAppearance("heroBgImage", data.url);
                                  } else {
                                    setError(data.error || "Error subiendo imagen");
                                  }
                                } catch {
                                  setError("Error subiendo imagen");
                                } finally {
                                  setUploadingHeroBg(false);
                                  e.target.value = "";
                                }
                              }}
                            />
                            {uploadingHeroBg ? (
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                <ImageIcon className="h-5 w-5" />
                                <span className="text-xs">Subir imagen de fondo (JPG, PNG, WebP — recomendado 1920×800px)</span>
                              </div>
                            )}
                          </label>
                        )}
                      </div>

                      {appearance.heroBgImage && (
                        <>
                          <div>
                            <label className="text-sm font-medium mb-1 block">
                              Opacidad de la imagen — {appearance.heroBgImageOpacity ?? 40}%
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={appearance.heroBgImageOpacity ?? 40}
                              onChange={(e) => updateAppearance("heroBgImageOpacity", parseInt(e.target.value))}
                              className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                              <span>0% (invisible)</span>
                              <span>100% (totalmente visible)</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Valores bajos (20-40%) muestran la imagen sutil sobre fondo oscuro. Ideal para legibilidad del texto.
                            </p>
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-1 block">
                              Zoom / Escala — {appearance.heroBgImageSize ?? 100}%
                            </label>
                            <input
                              type="range"
                              min="100"
                              max="250"
                              step="5"
                              value={appearance.heroBgImageSize ?? 100}
                              onChange={(e) => updateAppearance("heroBgImageSize", parseInt(e.target.value))}
                              className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                              <span>100% (original)</span>
                              <span>250% (zoom maximo)</span>
                            </div>
                          </div>

                          <div className="rounded-lg border overflow-hidden">
                            <p className="text-xs text-muted-foreground px-3 py-1.5 bg-muted/50 border-b">Vista previa del hero con imagen</p>
                            <div
                              className="relative h-36 overflow-hidden bg-slate-900"
                            >
                              <img
                                src={appearance.heroBgImage}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                                style={{
                                  opacity: (appearance.heroBgImageOpacity ?? 40) / 100,
                                  transform: `scale(${(appearance.heroBgImageSize ?? 100) / 100})`,
                                  transformOrigin: "center center",
                                }}
                              />
                              <div className="relative flex flex-col items-center justify-center h-full text-center px-4">
                                <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full mb-1.5">{form.storeSlogan}</span>
                                <span className="text-sm font-bold text-white">{form.heroTitle || "Titulo principal"}</span>
                                <span className="text-[10px] text-white/50 mt-1 max-w-xs">{form.heroDescription || "Descripcion"}</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
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
                    className="relative overflow-hidden text-center text-white text-xs"
                    style={{
                      backgroundColor:
                        appearance.heroBgType === "solid"
                          ? appearance.heroBgSolid
                          : "#0f172a",
                    }}
                  >
                    {appearance.heroBgType === "image" && appearance.heroBgImage && (
                      <img
                        src={appearance.heroBgImage}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{
                          opacity: (appearance.heroBgImageOpacity ?? 40) / 100,
                          transform: `scale(${(appearance.heroBgImageSize ?? 100) / 100})`,
                          transformOrigin: "center center",
                        }}
                      />
                    )}
                    <div className="relative px-4 py-6">
                      <p className="font-bold">{form.storeName}</p>
                      <p className="opacity-70 mt-1">{form.storeSlogan}</p>
                    </div>
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
              {paypalStatus ? (
                <div className="space-y-4">
                  {/* Mode toggle */}
                  <div className={`p-4 rounded-lg border-2 ${paypalStatus.mode === "live" ? "border-green-400 bg-green-50" : "border-amber-400 bg-amber-50"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${paypalStatus.mode === "live" ? "bg-green-500" : "bg-amber-500"}`} />
                          <span className="font-bold text-sm">
                            {paypalStatus.mode === "live" ? "MODO PRODUCCION (LIVE)" : "MODO SANDBOX (PRUEBAS)"}
                          </span>
                        </div>
                        <p className={`text-xs mt-1 ${paypalStatus.mode === "live" ? "text-green-700" : "text-amber-700"}`}>
                          {paypalStatus.mode === "live"
                            ? "Los pagos son REALES. El dinero va a tu cuenta PayPal."
                            : "Los pagos son de prueba. No se cobra dinero real."}
                        </p>
                      </div>
                      <Button
                        variant={paypalStatus.mode === "live" ? "outline" : "default"}
                        size="sm"
                        disabled={togglingMode}
                        className={`gap-2 ${paypalStatus.mode === "sandbox" ? "bg-green-600 hover:bg-green-700 text-white" : "border-amber-400 text-amber-800 hover:bg-amber-100"}`}
                        onClick={async () => {
                          const targetMode = paypalStatus.mode === "live" ? "sandbox" : "live";
                          const msg = targetMode === "live"
                            ? "CAMBIAR A PRODUCCION (LIVE)?\n\nLos pagos seran REALES.\nAsegurate de tener las credenciales LIVE configuradas."
                            : "Cambiar a SANDBOX (pruebas)?\n\nLos pagos seran de prueba.";
                          if (!confirm(msg)) return;
                          setTogglingMode(true);
                          setModeError("");
                          try {
                            const res = await fetch("/api/admin/settings", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "toggle_paypal_mode", mode: targetMode }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "Error");
                            await loadSettings();
                          } catch (err: unknown) {
                            setModeError(err instanceof Error ? err.message : "Error al cambiar modo");
                          } finally {
                            setTogglingMode(false);
                          }
                        }}
                      >
                        {togglingMode ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {paypalStatus.mode === "live" ? "Cambiar a Sandbox" : "Cambiar a Live"}
                      </Button>
                    </div>
                    {modeError && (
                      <div className="mt-2 bg-red-100 border border-red-300 rounded p-2 text-xs text-red-800">{modeError}</div>
                    )}
                  </div>

                  {/* Active mode credentials */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={`p-3 rounded-lg border text-center ${paypalStatus.clientIdConfigured ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                      <div className={`text-xs font-medium ${paypalStatus.clientIdConfigured ? "text-emerald-700" : "text-red-700"}`}>Client ID</div>
                      <div className={`text-sm font-bold mt-1 ${paypalStatus.clientIdConfigured ? "text-emerald-800" : "text-red-800"}`}>
                        {paypalStatus.clientIdConfigured ? "Configurado" : "No configurado"}
                      </div>
                      {paypalStatus.clientIdMasked && (
                        <div className="text-[10px] font-mono text-muted-foreground mt-1">{paypalStatus.clientIdMasked}</div>
                      )}
                    </div>
                    <div className={`p-3 rounded-lg border text-center ${paypalStatus.secretConfigured ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                      <div className={`text-xs font-medium ${paypalStatus.secretConfigured ? "text-emerald-700" : "text-red-700"}`}>Client Secret</div>
                      <div className={`text-sm font-bold mt-1 ${paypalStatus.secretConfigured ? "text-emerald-800" : "text-red-800"}`}>
                        {paypalStatus.secretConfigured ? "Configurado" : "No configurado"}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg border text-center ${paypalStatus.webhookIdConfigured ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                      <div className={`text-xs font-medium ${paypalStatus.webhookIdConfigured ? "text-emerald-700" : "text-amber-700"}`}>Webhook ID</div>
                      <div className={`text-sm font-bold mt-1 ${paypalStatus.webhookIdConfigured ? "text-emerald-800" : "text-amber-800"}`}>
                        {paypalStatus.webhookIdConfigured ? "Configurado" : "Opcional"}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border text-center bg-slate-50 border-slate-200">
                      <div className="text-xs font-medium text-slate-600">API URL</div>
                      <div className="text-[10px] font-mono mt-1 text-slate-700">
                        {paypalStatus.mode === "live" ? "api-m.paypal.com" : "api-m.sandbox.paypal.com"}
                      </div>
                    </div>
                  </div>

                  {/* Sandbox vs Live credential comparison */}
                  {paypalStatus.sandbox && paypalStatus.live && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`p-3 rounded-lg border ${paypalStatus.mode === "sandbox" ? "border-amber-300 ring-2 ring-amber-200" : "border-slate-200"}`}>
                        <div className="text-xs font-bold mb-2 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          Sandbox
                          {paypalStatus.mode === "sandbox" && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-1">ACTIVO</span>}
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">Client ID</span><span className={paypalStatus.sandbox.clientIdConfigured ? "text-emerald-600" : "text-red-500"}>{paypalStatus.sandbox.clientIdConfigured ? "OK" : "Falta"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Secret</span><span className={paypalStatus.sandbox.secretConfigured ? "text-emerald-600" : "text-red-500"}>{paypalStatus.sandbox.secretConfigured ? "OK" : "Falta"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Webhook</span><span className={paypalStatus.sandbox.webhookIdConfigured ? "text-emerald-600" : "text-slate-400"}>{paypalStatus.sandbox.webhookIdConfigured ? "OK" : "N/A"}</span></div>
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg border ${paypalStatus.mode === "live" ? "border-green-300 ring-2 ring-green-200" : "border-slate-200"}`}>
                        <div className="text-xs font-bold mb-2 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Live
                          {paypalStatus.mode === "live" && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded ml-1">ACTIVO</span>}
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">Client ID</span><span className={paypalStatus.live.clientIdConfigured ? "text-emerald-600" : "text-red-500"}>{paypalStatus.live.clientIdConfigured ? "OK" : "Falta"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Secret</span><span className={paypalStatus.live.secretConfigured ? "text-emerald-600" : "text-red-500"}>{paypalStatus.live.secretConfigured ? "OK" : "Falta"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Webhook</span><span className={paypalStatus.live.webhookIdConfigured ? "text-emerald-600" : "text-slate-400"}>{paypalStatus.live.webhookIdConfigured ? "OK" : "N/A"}</span></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!paypalStatus.clientIdConfigured || !paypalStatus.secretConfigured ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                      <p className="font-medium">PayPal no esta configurado para el modo {paypalStatus.mode.toUpperCase()}</p>
                      <p className="mt-1 text-red-700">Configura las credenciales en <code className="bg-red-100 px-1 rounded">.env.production</code> en el servidor.</p>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                      <p className="font-medium">PayPal esta configurado y listo ({paypalStatus.mode === "live" ? "Produccion" : "Sandbox"})</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Cargando estado de PayPal...</div>
              )}

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
                  <li>Copiar el <strong>Client ID</strong> y el <strong>Secret</strong> (para Sandbox Y para Live)</li>
                  <li>Agregar las variables en <code className="bg-blue-100 px-1 rounded">.env.production</code> en el servidor</li>
                  <li>Reiniciar el contenedor: <code className="bg-blue-100 px-1 rounded">bash scripts/update.sh</code></li>
                  <li>Usar el boton de arriba para cambiar entre Sandbox y Live</li>
                </ol>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                <p className="font-medium text-amber-800">Variables en <code>.env.production</code>:</p>
                <pre className="mt-2 bg-amber-100/50 p-3 rounded text-xs font-mono text-amber-900 overflow-x-auto">{`# Sandbox (pruebas)
PAYPAL_SANDBOX_CLIENT_ID=tu_sandbox_client_id
PAYPAL_SANDBOX_CLIENT_SECRET=tu_sandbox_secret
PAYPAL_SANDBOX_WEBHOOK_ID=tu_sandbox_webhook_id

# Live (produccion)
PAYPAL_LIVE_CLIENT_ID=tu_live_client_id
PAYPAL_LIVE_CLIENT_SECRET=tu_live_secret
PAYPAL_LIVE_WEBHOOK_ID=tu_live_webhook_id

# Legacy (si solo tienes un set de credenciales)
# PAYPAL_CLIENT_ID=fallback_client_id
# PAYPAL_CLIENT_SECRET=fallback_secret`}</pre>
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
