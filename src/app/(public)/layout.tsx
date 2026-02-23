import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Gamepad2 } from "lucide-react";
import { getSettings, splitStoreName } from "@/lib/settings";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const { prefix, highlight } = splitStoreName(settings.storeName);

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      <footer className="bg-slate-900 text-white" style={{ backgroundColor: "var(--site-footer-bg)", color: "var(--site-footer-text)" }}>
        <div className="container py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt={settings.storeName} className="h-8 max-w-[160px] object-contain" />
                ) : (
                  <>
                    <div className="p-1.5 rounded-lg bg-indigo-500/20">
                      <Gamepad2 className="h-5 w-5 text-indigo-400" />
                    </div>
                    <span className="font-extrabold text-lg tracking-tight">
                      {prefix}<span className="text-indigo-400">{highlight}</span>
                    </span>
                  </>
                )}
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {settings.storeSlogan}. Plugins, mapas, configs y source code.
              </p>
            </div>

            {/* Products */}
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-300 mb-4">Productos</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/catalog" className="text-slate-400 hover:text-white transition-colors">Catálogo</Link></li>
                <li><Link href="/catalog" className="text-slate-400 hover:text-white transition-colors">Plugins</Link></li>
                <li><Link href="/catalog" className="text-slate-400 hover:text-white transition-colors">Mapas</Link></li>
                <li><Link href="/catalog" className="text-slate-400 hover:text-white transition-colors">Configuraciones</Link></li>
                <li><Link href="/catalog" className="text-slate-400 hover:text-white transition-colors">Source Code</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-300 mb-4">Soporte</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/my-downloads" className="text-slate-400 hover:text-white transition-colors">Mis Descargas</Link></li>
                <li><Link href="/terms" className="text-slate-400 hover:text-white transition-colors">Términos de servicio</Link></li>
                <li><Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">Política de privacidad</Link></li>
              </ul>
            </div>

            {/* Payment */}
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-slate-300 mb-4">Pagos seguros</h4>
              <div className="space-y-3">
                <div className="bg-[#FFC439] text-black rounded-md h-9 w-28 flex items-center justify-center font-bold text-xs">
                  <span className="italic font-black tracking-tight">Pay</span>
                  <span className="italic font-black tracking-tight text-[#003087]">Pal</span>
                </div>
                <p className="text-xs text-slate-500">Todas las transacciones están protegidas por PayPal.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} {settings.storeName}. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <Link href="/terms" className="hover:text-slate-300 transition-colors">Términos</Link>
              <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacidad</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
