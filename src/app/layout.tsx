import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { SiteSettingsProvider } from "@/components/providers/site-settings-provider";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { storeName, storeSlogan } = await getSettings();
  return {
    title: {
      default: `${storeName} — ${storeSlogan}`,
      template: `%s | ${storeName}`,
    },
    description:
      `Tienda de productos digitales premium para servidores de Minecraft. Plugins, mapas, configuraciones y source code con entrega instantánea y pago seguro por PayPal.`,
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
        "Productos digitales premium para Minecraft. Entrega instantánea, pago seguro por PayPal.",
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
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSettings();
  const a = settings.appearance;

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
        <link rel="canonical" href={process.env.APP_URL || "http://localhost:3000"} />
      </head>
      <body className={inter.className} style={cssVars}>
        <SiteSettingsProvider settings={settings}>
          {children}
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
