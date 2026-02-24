"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Loader2, FileText, RotateCcw, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const DEFAULT_TERMS = `# TÉRMINOS Y CONDICIONES — {{STORE_NAME}}

**Versión:** v1.0

Estos Términos regulan la compra y uso de productos digitales para Minecraft ofrecidos por {{STORE_NAME}}.

## Productos Digitales
Los productos se entregan electrónicamente mediante enlaces de descarga seguros con límites de tiempo y cantidad.

## Política de No Reembolso
Debido a la naturaleza digital del contenido, las compras no son reembolsables una vez entregado el producto, salvo que la ley aplicable exija lo contrario.

## Licencia de Uso
Se otorga una licencia limitada, no exclusiva, no transferible y revocable. Está prohibido revender, redistribuir o compartir los productos.

## Evidencia y Registros
La Tienda registra eventos técnicos (timestamps, IP cifrada, User-Agent, hashes SHA256) como evidencia operativa para prevención de fraude y respuesta a disputas.

## Contacto
Email: {{CONTACT_EMAIL}}

---

# TERMS AND CONDITIONS — {{STORE_NAME}}

**Version:** v1.0

These Terms govern the purchase and use of digital Minecraft products offered by {{STORE_NAME}}.

## Digital Products
Products are delivered electronically via secure download links with time and quantity limits.

## No-Refund Policy
Due to the digital nature of the content, purchases are non-refundable once delivered, unless applicable law requires otherwise.

## License
A limited, non-exclusive, non-transferable, revocable license is granted. Reselling, redistributing, or sharing products is prohibited.

## Evidence and Logs
The Store records technical events (timestamps, encrypted IP, User-Agent, SHA256 hashes) as operational evidence for fraud prevention and dispute response.

## Contact
Email: {{CONTACT_EMAIL}}

---

# POLÍTICA DE PRIVACIDAD — {{STORE_NAME}}

**Versión:** v1.0

## Qué datos recopilamos
Datos de compra (email, producto, IDs de orden), datos técnicos (timestamps, User-Agent, hashes SHA256, logs) e IP cifrada (AES-256-GCM).

## Para qué usamos tus datos
Procesar compras, prevenir fraude, cumplir obligaciones legales y responder a disputas.

## Retención de datos
Conservamos evidencia por un período orientativo de 540 días (~18 meses).

## Seguridad
Aplicamos cifrado de IP, tokens firmados, registros append-only y control de acceso administrativo.

## Tus derechos
Puedes solicitar acceso, corrección o eliminación de tus datos personales enviando un email a {{PRIVACY_EMAIL}}.

## Contacto
Email de privacidad: {{PRIVACY_EMAIL}}

---

# PRIVACY POLICY — {{STORE_NAME}}

**Version:** v1.0

## Data We Collect
Purchase data (email, product, order IDs), technical data (timestamps, User-Agent, SHA256 hashes, logs), and encrypted IP (AES-256-GCM).

## How We Use Your Data
Process purchases, prevent fraud, comply with legal obligations, and respond to disputes.

## Data Retention
We retain evidence for an indicative period of 540 days (~18 months).

## Security
We apply IP encryption, signed tokens, append-only logs, and administrative access control.

## Your Rights
You may request access, correction, or deletion of your personal data by emailing {{PRIVACY_EMAIL}}.

## Contact
Privacy email: {{PRIVACY_EMAIL}}`;

export default function AdminTermsPage() {
  const [content, setContent] = useState("");
  const [versionLabel, setVersionLabel] = useState("v1.0");
  const [contentHash, setContentHash] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exists, setExists] = useState(false);

  const loadTerms = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/terms");
      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.content) {
          setContent(data.content);
          setVersionLabel(data.versionLabel || "v1.0");
          setContentHash(data.contentHash || "");
          setExists(true);
        }
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/admin/terms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, versionLabel }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error guardando términos");
        return;
      }

      const data = await res.json();
      setContentHash(data.contentHash || "");
      setExists(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const loadTemplate = () => {
    setContent(DEFAULT_TERMS);
    setVersionLabel("v1.0");
    setSaved(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Términos y Privacidad
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edita los términos de servicio y política de privacidad. Se muestran en /terms y /privacy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/terms" target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-1" /> Ver público
            </a>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">{error}</div>
      )}

      {saved && (
        <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg flex items-center gap-2">
          <Check className="h-4 w-4" /> Términos guardados correctamente. Las páginas públicas se actualizaron.
        </div>
      )}

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Contenido</CardTitle>
            <CardDescription>
              Usa formato Markdown. Incluye tanto Términos como Privacidad en ES e EN.
              Las variables <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{STORE_NAME}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{CONTACT_EMAIL}}"}</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{PRIVACY_EMAIL}}"}</code> se reemplazan automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Versión</label>
                <Input
                  value={versionLabel}
                  onChange={(e) => { setVersionLabel(e.target.value); setSaved(false); }}
                  placeholder="v1.0"
                  className="max-w-[150px]"
                />
              </div>
              {contentHash && (
                <div className="text-xs text-muted-foreground mt-5">
                  Hash: {contentHash.slice(0, 16)}…
                </div>
              )}
              {!exists && (
                <Button type="button" variant="outline" size="sm" className="mt-5 gap-1" onClick={loadTemplate}>
                  <RotateCcw className="h-3.5 w-3.5" /> Cargar plantilla completa
                </Button>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Contenido Markdown (Términos + Privacidad, ES + EN)
              </label>
              <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); setSaved(false); }}
                rows={30}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[400px]"
                placeholder="# TÉRMINOS Y CONDICIONES — {{STORE_NAME}}&#10;&#10;..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                {content.length} caracteres · Tip: Usa # para títulos, ## para secciones, **texto** para negrita, - para listas.
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving || content.length < 10} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Guardando..." : saved ? "Guardado" : "Guardar términos"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Estructura recomendada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground space-y-1 font-mono">
            <p># TÉRMINOS Y CONDICIONES — {"{{STORE_NAME}}"}</p>
            <p className="text-slate-400">... contenido en español ...</p>
            <p>---</p>
            <p># TERMS AND CONDITIONS — {"{{STORE_NAME}}"}</p>
            <p className="text-slate-400">... english content ...</p>
            <p>---</p>
            <p># POLÍTICA DE PRIVACIDAD — {"{{STORE_NAME}}"}</p>
            <p className="text-slate-400">... contenido en español ...</p>
            <p>---</p>
            <p># PRIVACY POLICY — {"{{STORE_NAME}}"}</p>
            <p className="text-slate-400">... english content ...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
