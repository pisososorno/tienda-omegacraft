import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mis Descargas",
  robots: { index: false, follow: false },
};

export default function MyDownloadsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
