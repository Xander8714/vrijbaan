import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigatie from "@/components/Navigatie";
import Footer from "@/components/Footer";
import GoogleAnalytics from "@/components/GoogleAnalytics";

// NEXT_PUBLIC_SITE_URL staat al in .env.local (voor de Telegram-deep-link) —
// hergebruikt hier als canonical/OG-basis, zodat één variabele bepaalt welk
// domein overal in de metadata verschijnt (nu vrijbaan.vercel.app, straks
// devrijebaan.nl zonder deze bestanden aan te hoeven passen).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vrijbaan.vercel.app";

// SEO-strategie (2 augustus 2026, zie PROJECTPLAN.md): kernzoekwoorden zijn
// "padel baan vrij"/"padelbaan boeken"/"padel beschikbaarheid" + stadsnaam.
// Titel-template zorgt dat elke pagina "| VrijeBaan" achter zijn eigen titel
// krijgt zonder dat te herhalen op elke page.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "VrijeBaan — Vind een vrije padelbaan in de buurt", template: "%s | VrijeBaan" },
  description:
    "Live beschikbaarheid van padelbanen bij jou in de buurt — Playtomic-, KNLTB Meet & Play- en Peakz-clubs door heel Nederland. Zoek op adres, filter op tijd, en boek direct bij de club.",
  keywords: [
    "padel baan vrij",
    "padelbaan boeken",
    "padel beschikbaarheid",
    "vrije padelbaan",
    "padel radar",
    "padelbaan reserveren",
  ],
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: "VrijeBaan",
    title: "VrijeBaan — Vind een vrije padelbaan in de buurt",
    description: "Live beschikbaarheid van padelbanen bij jou in de buurt. Zoek op adres, filter op tijd, boek direct bij de club.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "VrijeBaan — Vind een vrije padelbaan in de buurt",
    description: "Live beschikbaarheid van padelbanen bij jou in de buurt.",
  },
};

export const viewport: Viewport = { themeColor: "#0b1412" };

// WebSite-structured data — helpt zoekmachines de site correct als geheel te
// begrijpen (naam, taal, doel). Bewust minimaal: geen SearchAction, want er
// is geen site-brede zoekpagina die een query-parameter accepteert (Radar
// filtert op locatie/straal, niet op vrije tekst).
const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "VrijeBaan",
  url: SITE_URL,
  description: "Live beschikbaarheid van padelbanen bij jou in de buurt.",
  inLanguage: "nl-NL",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>
      <body className="baan-achtergrond-licht bg-court-50 antialiased">
        <Navigatie />
        {children}
        <Footer />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
