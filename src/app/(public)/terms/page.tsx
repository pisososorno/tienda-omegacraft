import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Shield, FileText, Globe } from "lucide-react";
import Link from "next/link";
import { getSettings, injectSettingsIntoContent } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { storeName } = await getSettings();
  return {
    title: `Términos y Condiciones | ${storeName}`,
    description: `Términos y condiciones para la compra y uso de productos digitales en ${storeName}.`,
  };
}

// ── Fallback estático (usado si la DB no está disponible) ──
const FALLBACK_TERMS_ES = `# TÉRMINOS Y CONDICIONES — {{STORE_NAME}}

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
Para ver los términos completos, por favor intente recargar la página o contacte soporte.`;

const FALLBACK_TERMS_EN = `# TERMS AND CONDITIONS — {{STORE_NAME}}

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
To view full terms, please reload the page or contact support.`;

// ── Markdown ligero → JSX ──
function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc pl-6 space-y-1 text-slate-600 text-sm leading-relaxed">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  function renderInline(text: string): React.ReactNode {
    // Bold **text**
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIdx = 0;
    let match;
    let partKey = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.slice(lastIdx, match.index));
      }
      parts.push(<strong key={partKey++} className="font-semibold text-slate-800">{match[1]}</strong>);
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx));
    }
    return parts.length > 0 ? parts : text;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      flushList();
      continue;
    }

    if (trimmed === "---") {
      flushList();
      elements.push(<hr key={key++} className="my-6 border-slate-200" />);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={key++} className="text-2xl font-bold text-slate-900 mt-8 mb-3">
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={key++} className="text-lg font-semibold text-slate-800 mt-6 mb-2 border-b border-slate-100 pb-1">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={key++} className="text-base font-semibold text-slate-700 mt-4 mb-1">
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote key={key++} className="border-l-4 border-indigo-300 bg-indigo-50/50 pl-4 py-2 my-3 text-sm text-slate-600 italic rounded-r">
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Párrafo normal
    flushList();
    elements.push(
      <p key={key++} className="text-sm text-slate-600 leading-relaxed mb-2">
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();
  return elements;
}

// ── Componente de tabs idioma (client island mínimo) ──
function LanguageContent({
  esContent,
  enContent,
}: {
  esContent: string;
  enContent: string;
}) {
  return (
    <div>
      {/* Español */}
      <div id="terms-es">
        <div className="flex items-center gap-2 mb-6">
          <Globe className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Español
          </span>
          <span className="text-xs text-slate-400">|</span>
          <a href="#terms-en" className="text-xs text-indigo-500 hover:text-indigo-700 underline">
            Switch to English ↓
          </a>
        </div>
        <div className="space-y-1">{renderMarkdown(esContent)}</div>
      </div>

      <hr className="my-12 border-slate-300" />

      {/* English */}
      <div id="terms-en">
        <div className="flex items-center gap-2 mb-6">
          <Globe className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            English
          </span>
          <span className="text-xs text-slate-400">|</span>
          <a href="#terms-es" className="text-xs text-indigo-500 hover:text-indigo-700 underline">
            Cambiar a Español ↑
          </a>
        </div>
        <div className="space-y-1">{renderMarkdown(enContent)}</div>
      </div>
    </div>
  );
}

// ── Separar contenido ES / EN ──
function splitContent(fullContent: string): { es: string; en: string } {
  // Buscar el separador entre las dos secciones de idioma
  const enMarkers = [
    "# TERMS AND CONDITIONS",
    "# PRIVACY POLICY",
  ];
  for (const marker of enMarkers) {
    const idx = fullContent.indexOf(marker);
    if (idx > 0) {
      return {
        es: fullContent.slice(0, idx).trim(),
        en: fullContent.slice(idx).trim(),
      };
    }
  }
  return { es: fullContent, en: "" };
}

// ── Page (Server Component) ──
export default async function TermsPage() {
  const settings = await getSettings();
  const inject = (text: string) => injectSettingsIntoContent(text, settings);

  let termsContent: string | null = null;
  let versionLabel = "";
  let contentHash = "";
  let fromDb = false;

  try {
    const terms = await prisma.termsVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (terms) {
      termsContent = terms.content;
      versionLabel = terms.versionLabel;
      contentHash = terms.contentHash;
      fromDb = true;
    }
  } catch (err) {
    console.error("[/terms] Error leyendo DB, usando fallback estático:", err);
  }

  // Separar ES/EN si el contenido contiene ambos idiomas
  let esContent: string;
  let enContent: string;

  if (termsContent) {
    const split = splitContent(termsContent);
    esContent = inject(split.es);
    enContent = inject(split.en);
  } else {
    esContent = inject(FALLBACK_TERMS_ES);
    enContent = inject(FALLBACK_TERMS_EN);
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white min-h-screen">
      <div className="container max-w-4xl py-12 px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-indigo-100 mb-4">
            <Shield className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Términos y Condiciones
          </h1>
          <p className="text-slate-500 text-sm">
            Regulan la compra y uso de productos digitales en {settings.storeName}
          </p>
          {fromDb && (
            <div className="mt-3 inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-1.5 text-xs text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              Versión {versionLabel} · Hash: {contentHash.slice(0, 12)}…
            </div>
          )}
          {!fromDb && (
            <div className="mt-3 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs text-amber-700">
              Versión estática de respaldo
            </div>
          )}
        </div>

        {/* Content card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 md:p-12">
          <LanguageContent esContent={esContent} enContent={enContent} />
        </div>

        {/* Footer links */}
        <div className="mt-8 text-center text-sm text-slate-400 space-y-2">
          <p>
            ¿Tienes preguntas? Contacta a{" "}
            <a href={`mailto:${settings.contactEmail}`} className="text-indigo-500 hover:underline">
              {settings.contactEmail}
            </a>
          </p>
          <p>
            <Link href="/privacy" className="text-indigo-500 hover:underline">
              Política de Privacidad
            </Link>
            {" · "}
            <Link href="/catalog" className="text-indigo-500 hover:underline">
              Volver al catálogo
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
