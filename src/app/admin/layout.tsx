"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Package,
  ShoppingCart,
  LogOut,
  LayoutDashboard,
  Loader2,
  Box,
  Settings,
  Users,
  UserCog,
  FileText,
  Store,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionProvider } from "next-auth/react";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/admin/login") {
      router.push("/admin/login");
    }
  }, [status, pathname, router]);

  // Login page doesn't get the admin chrome
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  const role = (session.user as Record<string, unknown>)?.role as string || "SELLER";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isStoreAdmin = role === "STORE_ADMIN";
  const isSeller = role === "SELLER";

  const navItem = (href: string, label: string, icon: React.ReactNode, match?: string) => (
    <Link href={href} key={href}>
      <Button
        variant={(match ? pathname?.startsWith(match) : pathname === href) ? "secondary" : "ghost"}
        className="w-full justify-start gap-2"
        size="sm"
      >
        {icon}
        {label}
      </Button>
    </Link>
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-lg">
            <Package className="h-5 w-5 text-primary" />
            {isSeller ? "Seller Panel" : "Admin Panel"}
          </Link>
          {role && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 block">
              {role.replace("_", " ")}
            </span>
          )}
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItem("/admin", "Dashboard", <LayoutDashboard className="h-4 w-4" />)}

          {/* Products: todos ven, pero SELLER ve "Mis Productos" */}
          {navItem("/admin/products", isSeller ? "Mis Productos" : "Products", <Box className="h-4 w-4" />, "/admin/products")}

          {/* Orders: todos ven, pero SELLER ve "Mis Órdenes" */}
          {navItem("/admin/orders", isSeller ? "Mis Órdenes" : "Orders", <ShoppingCart className="h-4 w-4" />, "/admin/orders")}

          {/* Sellers: solo SUPER_ADMIN */}
          {isSuperAdmin && navItem("/admin/sellers", "Sellers", <Store className="h-4 w-4" />, "/admin/sellers")}

          {/* Users: solo SUPER_ADMIN */}
          {isSuperAdmin && navItem("/admin/users", "Admin Users", <Users className="h-4 w-4" />, "/admin/users")}

          {/* Terms: SUPER_ADMIN y STORE_ADMIN */}
          {(isSuperAdmin || isStoreAdmin) && navItem("/admin/terms", "Terms & Privacy", <FileText className="h-4 w-4" />, "/admin/terms")}

          {/* Settings: solo SUPER_ADMIN */}
          {isSuperAdmin && navItem("/admin/settings", "Settings", <Settings className="h-4 w-4" />, "/admin/settings")}

          {/* Mi Perfil: solo SELLER */}
          {isSeller && navItem("/admin/my-profile", "Mi Perfil", <User className="h-4 w-4" />, "/admin/my-profile")}

          {/* Account: todos */}
          {navItem("/admin/account", "Mi Cuenta", <UserCog className="h-4 w-4" />, "/admin/account")}
        </nav>
        <div className="p-4 border-t">
          <div className="text-xs text-muted-foreground mb-2 truncate">
            {session.user?.email}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-destructive"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </SessionProvider>
  );
}
