import type { NextConfig } from "next";

/**
 * HTTP-securityheaders (5 aug 2026, security-assessment) — bewust GEEN
 * nonce-based CSP: die vereist dat elke pagina dynamic rendert (zie Next.js'
 * eigen CSP-gids, node_modules/next/dist/docs/.../content-security-policy.md
 * §"Static vs Dynamic Rendering"), en deze app steunt juist bewust op
 * statische/SSG-pagina's voor SEO (de stadspagina's, 4-5 aug 2026). Dat
 * zou een grotere, onbedoelde architectuurwijziging zijn voor een
 * hardeningstaak. In plaats daarvan de door Next.js zelf gedocumenteerde
 * "Without Nonces"-variant: `script-src 'self' 'unsafe-inline' <host>` —
 * zwakker tegen inline-script-XSS, maar blokkeert nog steeds externe
 * scriptbronnen, clickjacking (frame-ancestors), plugin-aanvallen
 * (object-src) en form-hijacking (form-action). SRI (experimenteel, zie
 * dezelfde gids) is bewust niet gebruikt — lost alleen externe-scriptintegriteit
 * op, niet het "geen nonce"-probleem voor de inline GA4-init-script en de
 * JSON-LD-structured-data in layout.tsx.
 *
 * Toegestane externe hosts zijn 1-op-1 herleid uit de code, niet geraden:
 * - googletagmanager.com: GoogleAnalytics.tsx laadt gtag.js vandaar.
 * - google-analytics.com: waar gtag() de meetdata naartoe stuurt.
 * - *.tile.openstreetmap.org: StadKaart.tsx (Leaflet) laadt de kaarttegels
 *   van a/b/c.tile.openstreetmap.org — pas ontdekt door de stadspagina
 *   live te openen en de console te checken (blokkeerde eerst stilzwijgend
 *   elke kaarttegel, geen enkele test zonder browser had dit gevonden).
 * - NEXT_PUBLIC_SUPABASE_URL: supabaseBrowser() praat rechtstreeks vanuit de
 *   client met Supabase (auth, profiel, radar-data) — hardcoded zou stil
 *   verouderen als het Supabase-project ooit verhuist.
 *
 * geolocation=(self) i.p.v. geolocation=() in Permissions-Policy: de Radar-
 * pagina gebruikt navigator.geolocation ("Gebruik mijn locatie") — een kale
 * geolocation=() zou die knop breken.
 *
 * HSTS zonder `preload`: preload staat op een lijst die in browsers zelf
 * wordt meegeleverd en duurt maanden om weer verwijderd te krijgen — dat is
 * een te grote, moeilijk terug te draaien stap om in dezelfde beweging als de
 * rest van deze hardening te zetten. max-age + includeSubDomains is al een
 * echte verbetering en blijft gewoon instelbaar/afschakelbaar.
 */
const isDev = process.env.NODE_ENV === "development";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://www.google-analytics.com https://www.googletagmanager.com https://*.tile.openstreetmap.org;
  font-src 'self' data:;
  connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com${supabaseUrl ? ` ${supabaseUrl}` : ""};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, " ").trim();

const nextConfig: NextConfig = {
  output: "standalone",
  // Verbergt de "X-Powered-By: Next.js"-header — server_tokens off op nginx
  // (VPS-config, niet in git) doet hetzelfde voor de nginx-versie in Server.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
