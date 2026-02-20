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

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-lg">
            <Package className="h-5 w-5 text-primary" />
            Admin Panel
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/admin">
            <Button
              variant={pathname === "/admin" ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              size="sm"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/products">
            <Button
              variant={pathname?.startsWith("/admin/products") ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              size="sm"
            >
              <Box className="h-4 w-4" />
              Products
            </Button>
          </Link>
          <Link href="/admin/orders">
            <Button
              variant={pathname?.startsWith("/admin/orders") ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              size="sm"
            >
              <ShoppingCart className="h-4 w-4" />
              Orders
            </Button>
          </Link>
          <Link href="/admin/settings">
            <Button
              variant={pathname?.startsWith("/admin/settings") ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              size="sm"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
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
