import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Lock, FileText, Globe } from "lucide-react";
import Link from "next/link";
import { getSettings, injectSettingsIntoContent } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { storeName } = await getSettings();
  return {
    title: `Política de Privacidad | ${storeName}`,
    description: `Política de privacidad para la compra y uso de productos digitales en ${storeName}.`,
  };
}

// ── Fallback estático ──
const FALLBACK_PRIVACY_ES = `# POLÍTICA DE PRIVACIDAD — {{STORE_NAME}}

**Versión:** v1.0

## Qué datos recopilamos
Datos de compra (email, producto, IDs de orden), datos técnicos (timestamps, User-Agent, hashes SHA256, logs) e IP cifrada (AES-256-GCM).

## Para qué usamos tus datos
Procesar compras, prevenir fraude, cumplir obligaciones legales y responder a disputas.

## Retención de datos
Conservamos evidencia por un período orientativo de 540 días (~18 meses).

## Seguridad
Aplicamos cifrado de IP, tokens firmados, registros append-only y control de acceso administrativo.

## Contacto
Email: {{PRIVACY_EMAIL}}

---
Para ver la política completa, por favor recargue la página o contacte soporte.`;

const FALLBACK_PRIVACY_EN = `# PRIVACY POLICY — {{STORE_NAME}}

**Version:** v1.0

## Data we collect
Purchase data (email, product, order IDs), technical data (timestamps, User-Agent, SHA256 hashes, logs), and encrypted IP (AES-256-GCM).

## How we use your data
Process orders, prevent fraud, comply with legal obligations, and respond to disputes.

## Data retention
We retain evidence for an indicative period of 540 days (~18 months).

## Security
We apply IP encryption, signed tokens, append-only logs, and admin access controls.

## Contact
Email: {{PRIVACY_EMAIL}}

---
To view the full policy, please reload the page or contact support.`;

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

    if (trimmed === "") { flushList(); continue; }

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

function LanguageContent({
  esContent,
  enContent,
}: {
  esContent: string;
  enContent: string;
}) {
  return (
    <div>
      <div id="privacy-es">
        <div className="flex items-center gap-2 mb-6">
          <Globe className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Español</span>
          <span className="text-xs text-slate-400">|</span>
          <a href="#privacy-en" className="text-xs text-indigo-500 hover:text-indigo-700 underline">
            Switch to English ↓
          </a>
        </div>
        <div className="space-y-1">{renderMarkdown(esContent)}</div>
      </div>

      <hr className="my-12 border-slate-300" />

      <div id="privacy-en">
        <div className="flex items-center gap-2 mb-6">
          <Globe className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">English</span>
          <span className="text-xs text-slate-400">|</span>
          <a href="#privacy-es" className="text-xs text-indigo-500 hover:text-indigo-700 underline">
            Cambiar a Español ↑
          </a>
        </div>
        <div className="space-y-1">{renderMarkdown(enContent)}</div>
      </div>
    </div>
  );
}

function splitPrivacyContent(fullContent: string): { es: string; en: string } {
  // Buscar marcador EN genérico (sin depender del nombre de la tienda)
  const regex = /^# PRIVACY POLICY — .+\(EN\)/m;
  const match = regex.exec(fullContent);
  if (match && match.index > 0) {
    return {
      es: fullContent.slice(0, match.index).trim(),
      en: fullContent.slice(match.index).trim(),
    };
  }
  // Fallback: buscar cualquier "# PRIVACY POLICY" después del inicio
  const idx = fullContent.indexOf("# PRIVACY POLICY", 10);
  if (idx > 0) {
    return {
      es: fullContent.slice(0, idx).trim(),
      en: fullContent.slice(idx).trim(),
    };
  }
  return { es: fullContent, en: "" };
}

export default async function PrivacyPage() {
  const settings = await getSettings();
  const inject = (text: string) => injectSettingsIntoContent(text, settings);

  let privacyContent: string | null = null;
  let versionLabel = "";
  let contentHash = "";
  let fromDb = false;

  try {
    // Buscar versión activa de privacidad, o usar los términos generales que incluyen privacidad
    const terms = await prisma.termsVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (terms) {
      // Extraer sección de privacidad si existe dentro del contenido
      const privacyIdx = terms.content.indexOf("# POLÍTICA DE PRIVACIDAD");
      if (privacyIdx >= 0) {
        privacyContent = terms.content.slice(privacyIdx);
        versionLabel = terms.versionLabel;
        contentHash = terms.contentHash;
        fromDb = true;
      }
    }
  } catch (err) {
    console.error("[/privacy] Error leyendo DB, usando fallback estático:", err);
  }

  let esContent: string;
  let enContent: string;

  if (privacyContent) {
    const split = splitPrivacyContent(privacyContent);
    esContent = inject(split.es);
    enContent = inject(split.en);
  } else {
    esContent = inject(FALLBACK_PRIVACY_ES);
    enContent = inject(FALLBACK_PRIVACY_EN);
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white min-h-screen">
      <div className="container max-w-4xl py-12 px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-indigo-100 mb-4">
            <Lock className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Política de Privacidad
          </h1>
          <p className="text-slate-500 text-sm">
            Cómo recopilamos, usamos y protegemos tus datos en {settings.storeName}
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
            <a href={`mailto:${settings.privacyEmail}`} className="text-indigo-500 hover:underline">
              {settings.privacyEmail}
            </a>
          </p>
          <p>
            <Link href="/terms" className="text-indigo-500 hover:underline">
              Términos y Condiciones
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
