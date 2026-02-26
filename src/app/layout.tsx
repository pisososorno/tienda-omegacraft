import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { SiteSettingsProvider } from "@/components/providers/site-settings-provider";
import { organizationSchema, webSiteSchema, jsonLd } from "@/lib/seo";

const inter = Inter({ subsets: ["latin"] });

const APP_URL = process.env.APP_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const { storeName, storeSlogan } = await getSettings();
  return {
    metadataBase: new URL(APP_URL),
    title: {
      default: `${storeName} — ${storeSlogan}`,
      template: `%s | ${storeName}`,
    },
    description:
      "Productos digitales premium para Minecraft: plugins, mapas, configs y source code. Entrega instantánea y pago seguro por PayPal.",
    publisher: storeName,
    keywords: [
      "minecraft plugins",
      "minecraft maps",
      "minecraft spawns",
      "minecraft server",
      "minecraft source code",
      "minecraft configurations",
      "tienda minecraft",
      "comprar plugins minecraft",
      "minecraft lobby",
      "minecraft dungeon map",
      "minecraft digital products",
      "buy minecraft plugins",
    ],
    authors: [{ name: storeName }],
    creator: storeName,
    openGraph: {
      type: "website",
      locale: "es_ES",
      siteName: storeName,
      title: `${storeName} — ${storeSlogan}`,
      description:
        "Productos digitales premium para Minecraft: plugins, mapas, configs y source code. Entrega instantánea.",
      url: APP_URL,
    },
    twitter: {
      card: "summary_large_image",
      title: `${storeName} — Productos Digitales para Minecraft`,
      description:
        "Plugins, mapas, configs y source code premium. Entrega instantánea.",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: "/",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSettings();
  const a = settings.appearance;

  // Global JSON-LD schemas — rendered in <head> for guaranteed View Source visibility
  const orgSchema = organizationSchema(settings.storeName, settings.logoUrl);
  const siteSchema = webSiteSchema(settings.storeName);

  // CSS custom properties for dynamic theming
  const cssVars = {
    "--site-primary": a.primaryColor,
    "--site-accent": a.accentColor,
    "--site-navbar-bg": a.navbarBg,
    "--site-navbar-text": a.navbarText,
    "--site-hero-bg-solid": a.heroBgSolid,
    "--site-body-bg": a.bodyBg,
    "--site-card-bg": a.cardBg,
    "--site-footer-bg": a.footerBg,
    "--site-footer-text": a.footerText,
    "--site-catalog-bg": a.catalogBg,
  } as React.CSSProperties;

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={a.primaryColor} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(siteSchema) }}
        />
      </head>
      <body className={inter.className} style={cssVars}>
        <SiteSettingsProvider settings={settings}>
          {children}
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
