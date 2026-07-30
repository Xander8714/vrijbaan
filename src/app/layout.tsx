import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigatie from "@/components/Navigatie";
export const metadata: Metadata = { title: "VrijBaan — Padel", description: "Beschikbaarheid-radar met zoekstraal voor padellers in Nederland.", manifest: "/manifest.json" };
export const viewport: Viewport = { themeColor: "#0b1412" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (<html lang="nl"><body className="bg-slate-50 antialiased"><Navigatie />{children}</body></html>);
}
