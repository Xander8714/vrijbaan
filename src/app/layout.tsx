import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "VrijBaan — Padel Haarlem", description: "Beschikbaarheid-radar en opstelling-optimizer voor padellers in Haarlem en omstreken.", manifest: "/manifest.json" };
export const viewport: Viewport = { themeColor: "#059669" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (<html lang="nl"><body className="bg-slate-50 antialiased">{children}</body></html>);
}
