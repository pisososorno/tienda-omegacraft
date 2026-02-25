"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Store, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/components/providers/site-settings-provider";
import { splitStoreName } from "@/lib/settings";

export function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/home" || pathname === "/";
  const { storeName, logoUrl, appearance } = useSiteSettings();
  const logoH = appearance?.logoHeight || 32;
  const { prefix, highlight } = splitStoreName(storeName);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isHome
          ? "bg-slate-900/80 backdrop-blur-xl border-b border-white/5"
          : "backdrop-blur-xl border-b shadow-sm"
      }`}
      style={!isHome ? { backgroundColor: "var(--site-navbar-bg, #ffffff)", color: "var(--site-navbar-text, #0f172a)" } : undefined}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} style={{ height: `${logoH}px` }} className="max-w-[200px] object-contain" />
          ) : (
            <>
              <div className={`p-1.5 rounded-lg ${isHome ? "bg-indigo-500/20" : "bg-indigo-50"}`}>
                <Gamepad2 className={`h-5 w-5 ${isHome ? "text-indigo-400" : "text-indigo-600"}`} />
              </div>
              <span className={`font-extrabold text-lg tracking-tight ${isHome ? "text-white" : "text-foreground"}`}>
                {prefix}<span className={isHome ? "text-indigo-400" : "text-indigo-600"}>{highlight}</span>
              </span>
            </>
          )}
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/catalog">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 rounded-lg font-medium ${
                isHome
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : pathname?.startsWith("/catalog")
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Store className="h-4 w-4" />
              Catálogo
            </Button>
          </Link>
          <Link href="/my-downloads">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 rounded-lg font-medium ${
                isHome
                  ? "text-white/70 hover:text-white hover:bg-white/10"
                  : pathname?.startsWith("/my-downloads")
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Download className="h-4 w-4" />
              Mis Descargas
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
