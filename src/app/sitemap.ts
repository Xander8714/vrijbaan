import type { MetadataRoute } from "next";
import { STAD_SLUGS } from "@/lib/stadsPaginas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vrijbaan.vercel.app";

// Alleen publieke, indexeerbare pagina's — /account, /login en
// /wachtwoord-resetten staan bewust niet hierin (zie hun robots: noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  const pagina = (pad: string, prioriteit: number, wijzigt: MetadataRoute.Sitemap[number]["changeFrequency"]) => ({
    url: `${SITE_URL}${pad}`,
    lastModified: new Date(),
    changeFrequency: wijzigt,
    priority: prioriteit,
  });

  return [
    pagina("", 1, "weekly"),
    pagina("/radar", 0.9, "daily"),
    pagina("/pricing", 0.6, "monthly"),
    pagina("/help", 0.5, "monthly"),
    pagina("/telegram", 0.5, "monthly"),
    // "Club aanmelden" tijdelijk uit de navigatie én sitemap (3 aug 2026,
    // zie de toelichting bij TABBLADEN in Navigatie.tsx) — pagina blijft
    // gewoon bestaan, alleen niet actief gepromoot.
    // pagina("/club-aanmelden", 0.4, "monthly"),
    // Statische stad-landingspagina's (4 aug 2026, SEO-review) — zie
    // src/lib/stadsPaginas.ts voor de keuze van deze zes steden.
    ...STAD_SLUGS.map((stad) => pagina(`/padelbaan-vrij/${stad}`, 0.7, "weekly")),
  ];
}
