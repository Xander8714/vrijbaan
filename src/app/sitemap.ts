import type { MetadataRoute } from "next";

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
    pagina("/club-aanmelden", 0.4, "monthly"),
  ];
}
