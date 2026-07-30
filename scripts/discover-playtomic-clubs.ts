/**
 * Ontdekt Playtomic-clubs in Nederland en genereert src/lib/clubs.playtomic.ts.
 *
 * HOE: elke clubpagina op playtomic.com bevat onderaan een blok "More available
 * clubs near <club>" met links naar `/clubs/<slug>` van clubs in de buurt
 * (geverifieerd 29 juli 2026 op wepadel-haarlem: o.a. padelpark-21,
 * padelhill, padeldam). Door daar in de breedte langs te lopen — steeds de
 * buren van gevonden clubs oppakken — rolt het netwerk van clubs zich uit over
 * het land, zonder dat Playtomic een clublijst-API nodig heeft.
 *
 * Coördinaten komen niet van Playtomic (die staan niet in de pagina) maar uit
 * de PDOK Locatieserver, op basis van het adres dat wél op de pagina staat.
 * Clubs waarvan het adres niet te geocoderen valt, worden overgeslagen in
 * plaats van op een gegokt punt gezet — een club op de verkeerde plek is erger
 * dan een club die (nog) niet in de lijst staat.
 *
 * Gebruik:
 *   npm run discover:playtomic                 # standaard maximaal 40 clubs
 *   npm run discover:playtomic -- 150           # ruimer, duurt langer
 *
 * Dit is een langlopend script (elke pagina kost een paar seconden). Draai het
 * bewust, niet als onderdeel van de build.
 */
import { writeFileSync } from "fs";
import { chromium, type Page } from "playwright";

const START_SLUGS = ["wepadel-haarlem", "indoor-padel25-haarlem"];
const MAX_CLUBS = Number(process.argv[2] ?? "40");
const PDOK_FREE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

type RuweClub = { slug: string; naam: string; adres: string | null; buren: string[]; banen: number };
type OntdekteClub = RuweClub & { lat: number; lon: number; plaats: string; banen: number };

// "Reinaldapark 10, 2033 SX, Haarlem" of "Naritaweg 10, 1043 CP Amsterdam".
// Globaal, want de pagina bevat het adres twee keer: bovenaan zónder plaats
// (daar volgt het breadcrumb "Home / Clubs / …" op, wat een naïeve match als
// plaatsnaam "Home" oplevert) en verderop mét de echte plaats.
const ADRES_RE = /([A-ZÀ-Ý][\w'.\- ]{2,60}?\s\d+[A-Za-z]?)\s*,\s*(\d{4}\s?[A-Z]{2})\s*,?\s*([A-ZÀ-Ý][\w'\- ]{2,40})/g;

// Woorden die uit de paginastructuur komen en dus nooit een plaatsnaam zijn.
const GEEN_PLAATS = /^(home|clubs|padel|available|amenities|opening)\b/i;

/** Kiest het adres met een plausibele plaatsnaam uit alle voorkomens. */
function zoekAdres(tekst: string): string | null {
  for (const m of tekst.matchAll(ADRES_RE)) {
    const plaats = m[3].trim();
    if (GEEN_PLAATS.test(plaats)) continue;
    return `${m[1]}, ${m[2]} ${plaats}`;
  }
  return null;
}

const LEES_CLUB_JS = `(() => {
  var tekst = document.body.innerText || "";
  var h1 = document.querySelector("h1");
  var buren = Array.prototype.slice.call(document.querySelectorAll('a[href^="/clubs/"]'))
    .map(function (a) { return (a.getAttribute("href") || "").replace("/clubs/", "").split("?")[0]; })
    .filter(function (s) { return s.length > 0; });
  var banen = document.querySelectorAll('details[class*="group/resource"]').length;
  return { tekst: tekst.slice(0, 4000), kop: (h1 && h1.innerText) || "", buren: buren, banen: banen };
})()`;

/** null = pagina niet geladen/dode slug. "geblokkeerd" = expliciet een 403 — apart houden, want dat is geen dode club maar een WAF-reactie (zie PROJECTPLAN.md, 29 juli 2026). */
async function leesClub(page: Page, slug: string): Promise<RuweClub | null | "geblokkeerd"> {
  const respons = await page
    .goto(`https://playtomic.com/clubs/${slug}`, { waitUntil: "domcontentloaded", timeout: 45000 })
    .catch(() => null);
  if (respons?.status() === 403) return "geblokkeerd";
  if (!respons || respons.status() >= 400) return null;
  await page.waitForTimeout(2500);

  const data = (await page.evaluate(LEES_CLUB_JS)) as {
    tekst: string;
    kop: string;
    buren: string[];
    banen: number;
  };

  // De <h1> is "Book a court in\n<Clubnaam>" — alleen de clubnaam willen we.
  const naam = (data.kop || slug).replace(/^\s*Book a court in\s*/i, "").trim();

  return {
    slug,
    naam: naam || slug,
    adres: zoekAdres(data.tekst),
    buren: [...new Set(data.buren)],
    // Aantal banen = aantal baan-elementen in het rooster. Betrouwbaar ook als
    // er die dag niets vrij is: Playtomic rendert de baan dan gewoon met
    // "No slots available" (bevestigd 29 juli 2026 bij WePadel om ~22:00, waar
    // alle 8 banen nog netjes als element aanwezig waren).
    banen: data.banen,
  };
}

/** Geocodeert een adres via PDOK; null als er geen betrouwbare match is. */
async function geocodeer(adres: string): Promise<{ lat: number; lon: number; plaats: string } | null> {
  const url = new URL(PDOK_FREE);
  url.searchParams.set("q", adres);
  url.searchParams.set("fq", "type:(adres OR weg)");
  url.searchParams.set("rows", "1");
  url.searchParams.set("fl", "weergavenaam,woonplaatsnaam,centroide_ll,straatnaam");
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    response?: { docs?: { centroide_ll?: string; woonplaatsnaam?: string; straatnaam?: string }[] };
  };
  const doc = data.response?.docs?.[0];
  if (!doc?.centroide_ll) return null;

  // PDOK matcht fuzzy (zie src/lib/geo.ts): als de gevonden straatnaam niet in
  // het opgegeven adres voorkomt, is dit een ander adres en gooien we het weg.
  if (doc.straatnaam && !adres.toLowerCase().includes(doc.straatnaam.toLowerCase())) return null;

  const m = /^POINT\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/.exec(doc.centroide_ll);
  if (!m) return null;
  return { lat: Number(m[2]), lon: Number(m[1]), plaats: doc.woonplaatsnaam ?? "" };
}

function slugify(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "nl-NL",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();

  const tebezoeken = [...START_SLUGS];
  const bezocht = new Set<string>();
  const gevonden: OntdekteClub[] = [];
  const overgeslagen: string[] = [];

  try {
    while (tebezoeken.length > 0 && bezocht.size < MAX_CLUBS) {
      const slug = tebezoeken.shift()!;
      if (bezocht.has(slug)) continue;
      bezocht.add(slug);

      const ruw = await leesClub(page, slug);

      // Bewust STOPPEN, niet negeren: op 29 juli 2026 gaf herhaald pollen een
      // 403 die later bleek tijdelijk. Dwars doorheen blijven crawlen zou
      // tientallen clubs onterecht als "pagina niet geladen" wegschrijven en
      // de block mogelijk verlengen. Wat tot nu toe gevonden is, is al bewaard.
      if (ruw === "geblokkeerd") {
        console.log(`\n⚠ Playtomic gaf 403 bij ${slug} — crawl gestopt (niet: club overgeslagen).`);
        console.log("Dit bleek eerder een tijdelijke rate-limit, geen permanente block. Probeer over een uur opnieuw.");
        break;
      }
      if (!ruw) { overgeslagen.push(`${slug} (pagina niet geladen)`); continue; }

      for (const buur of ruw.buren) if (!bezocht.has(buur)) tebezoeken.push(buur);

      // Nette pauze tussen clubs — zelfde redenering als pauzeerVoorPlaytomic
      // in scripts/poll-availability.ts.
      await page.waitForTimeout(1000 + Math.random() * 1500);

      if (!ruw.adres) { overgeslagen.push(`${ruw.slug} (geen adres in pagina)`); continue; }
      const punt = await geocodeer(ruw.adres);
      if (!punt) { overgeslagen.push(`${ruw.slug} (adres "${ruw.adres}" niet te geocoderen)`); continue; }

      gevonden.push({ ...ruw, ...punt });
      console.log(`  ✓ ${ruw.naam} — ${punt.plaats} (${gevonden.length} gevonden, ${tebezoeken.length} in wachtrij)`);
    }
  } finally {
    await browser.close();
  }

  const vandaag = new Date().toISOString().slice(0, 10);
  const regels = gevonden
    .slice()
    .sort((a, b) => a.plaats.localeCompare(b.plaats, "nl"))
    .map((c) => {
      const id = `playtomic-${slugify(c.slug)}`;
      return (
        `  { id: ${JSON.stringify(id)}, naam: ${JSON.stringify(c.naam)}, plaats: ${JSON.stringify(c.plaats)}, ` +
        `banen: ${c.banen}, systeem: "Playtomic", ` +
        `status: ${JSON.stringify(`Actief - Playtomic slug ${c.slug}`)}, ` +
        `boekingsUrl: ${JSON.stringify(`https://playtomic.com/clubs/${c.slug}`)}, ` +
        `adres: ${JSON.stringify(c.adres)}, lat: ${c.lat}, lon: ${c.lon}, coordinaatBron: "adres", ` +
        // Playtomic-clubs zijn commercieel: boeken kan zonder lidmaatschap.
        `boekbaarZonderLidmaatschap: true, playtomicSlug: ${JSON.stringify(c.slug)} },`
      );
    });

  const inhoud = `// AUTOMATISCH GEGENEREERD — niet met de hand aanpassen.
// Bron: playtomic.com/clubs/<slug>, ontdekt via de "clubs in de buurt"-links.
// Coordinaten via de PDOK Locatieserver op basis van het adres op de clubpagina.
// Opnieuw genereren met: npm run discover:playtomic -- <maxClubs>
// Laatst gegenereerd: ${vandaag} — ${gevonden.length} clubs (${bezocht.size} pagina's bezocht).
//
// banen = het aantal baan-elementen in het rooster op de clubpagina. banen: 0
// betekent "niet gemeten" (bv. pagina laadde traag), niet "geen banen".
import { Club } from "./types";

export type PlaytomicClub = Club & { playtomicSlug: string };

export const PLAYTOMIC_CLUBS: PlaytomicClub[] = [
${regels.join("\n")}
];
`;

  const pad = "src/lib/clubs.playtomic.ts";
  writeFileSync(pad, inhoud, "utf8");
  console.log(`\n${gevonden.length} clubs weggeschreven naar ${pad} (${bezocht.size} pagina's bezocht).`);
  if (overgeslagen.length > 0) {
    console.log(`\nOvergeslagen (${overgeslagen.length}):`);
    for (const o of overgeslagen) console.log(`  - ${o}`);
  }
}

main().catch((err) => {
  console.error("Ontdekken mislukt:", err);
  process.exit(1);
});
