/**
 * Ontdekt Meet & Play-padelclubs in heel Nederland en genereert
 * src/lib/clubs.meetandplay.ts.
 *
 * HOE: anders dan bij Playtomic (crawlen via "clubs in de buurt"-links) heeft
 * Meet & Play een complete directory op één pagina: `meetandplay.nl/club` met
 * een sportfilter (`select#sportId`, Livewire). Op "Padel" gefilterd toont die
 * pagina ALLE 401 padel-aangesloten clubs tegelijk, zonder paginering
 * (bevestigd 29 juli 2026 — `.c-club-card` per club, geen "volgende"-knop of
 * infinite scroll). Één paginabezoek volstaat dus voor de hele lijst; dat is
 * veel lichter dan de Playtomic-crawl (die wél per club een eigen paginabezoek
 * kost, en waarbij herhaald draaien al 403's opleverde — zie PROJECTPLAN.md).
 *
 * LET OP — `data-id` op de kaart is NIET het bruikbare club-id. Elke kaart
 * heeft een `data-id` (het interne Livewire-component-id) én een aparte
 * "Boeken"-link naar `/club/<echt-id>`. Die twee lopen NIET gelijk (bv. VLTV
 * Tennis & Padel: data-id="4396", maar de link is `/club/83402`). Dit script
 * gebruikt uitsluitend het id uit de link.
 *
 * BOEKBAAR ZONDER LIDMAATSCHAP — geverifieerd bij een steekproef van 4 clubs
 * (Hofgeest, Schoten, Groeneveen, én Pim Mulier — die laatste heeft zelfs een
 * ledenstop voor nieuwe leden, en toch werkte het identiek): een niet-lid kan
 * een slot in het winkelmandje leggen en "Afrekenen" stuurt naar een gratis
 * KNLTB ID-login (alleen e-mailadres), nooit naar een club-lidmaatschapscheck.
 * Dat is dus GEEN per-club-instelling maar hoe Meet & Play als KNLTB-breed
 * platform werkt. Op basis van die 4/4-steekproef zet dit script
 * `boekbaarZonderLidmaatschap: true` voor alle ontdekte clubs — een aanname,
 * niet 401x individueel geverifieerd. Duik hier opnieuw in als ooit een
 * tegenvoorbeeld opduikt.
 *
 * Aantal banen staat niet in de directory-kaart (alleen naam + adres) — hier
 * dus altijd 0 ("niet gemeten"), zelfde conventie als bij de Playtomic-crawl.
 *
 * Gebruik: npm run discover:meetandplay
 * (één paginabezoek + N PDOK-geocodeeraanroepen — een paar minuten, vooral
 * gelimiteerd door PDOK, niet door meetandplay.nl.)
 */
import { writeFileSync } from "fs";
import { chromium } from "playwright";

const PDOK_FREE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

// Al handmatig bekend (met eigen, uitgebreidere documentatie in clubs.ts) —
// niet dubbel opnemen.
const HANDMATIGE_IDS = new Set(["29942", "88181", "29850", "29462"]); // hofgeest, schoten, groeneveen, pim-mulier

type RuweClub = { clubId: string; naam: string; adres: string };
type OntdekteClub = RuweClub & { lat: number; lon: number; plaats: string };

async function haalDirectoryOp(): Promise<RuweClub[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto("https://meetandplay.nl/club", { waitUntil: "networkidle", timeout: 30000 });

    const cookie = page.locator("#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll");
    if (await cookie.isVisible({ timeout: 3000 }).catch(() => false)) await cookie.click();
    await page.waitForTimeout(1000);

    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/livewire/update"), { timeout: 15000 }),
      page.selectOption("#sportId", "2"), // 2 = Padel
    ]);
    await page.waitForTimeout(1500);

    return await page.$$eval(".c-club-card", (cards) =>
      cards.flatMap((c) => {
        const href = c.querySelector('a[href*="/club/"]')?.getAttribute("href") ?? "";
        const clubId = href.match(/\/club\/(\d+)/)?.[1];
        const naam = c.querySelector("h3")?.textContent?.trim();
        const adres = c.querySelector(".c-club-card__address")?.textContent?.trim();
        if (!clubId || !naam || !adres) return [];
        return [{ clubId, naam, adres }];
      })
    );
  } finally {
    await browser.close();
  }
}

/** Geocodeert "straat huisnr, postcode PLAATS" via PDOK; null bij twijfel. */
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

  // Zelfde anti-fuzzy-match-check als bij de Playtomic-crawl: PDOK matcht
  // fuzzy, dus een straatnaam die niet in het opgegeven adres voorkomt
  // betekent een ander adres.
  if (doc.straatnaam && !adres.toLowerCase().includes(doc.straatnaam.toLowerCase())) return null;

  const m = /^POINT\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/.exec(doc.centroide_ll);
  if (!m) return null;
  return { lat: Number(m[2]), lon: Number(m[1]), plaats: doc.woonplaatsnaam ?? "" };
}

async function main(): Promise<void> {
  console.log("Directory ophalen (één paginabezoek)…");
  const alle = await haalDirectoryOp();
  console.log(`${alle.length} padelclubs gevonden op meetandplay.nl/club.`);

  const teGeocoderen = alle.filter((c) => !HANDMATIGE_IDS.has(c.clubId));
  console.log(`${alle.length - teGeocoderen.length} al handmatig bekend, ${teGeocoderen.length} te geocoderen…`);

  const gevonden: OntdekteClub[] = [];
  const overgeslagen: string[] = [];

  for (const [i, club] of teGeocoderen.entries()) {
    const punt = await geocodeer(club.adres);
    if (!punt) {
      overgeslagen.push(`${club.naam} (adres "${club.adres}" niet te geocoderen)`);
    } else {
      gevonden.push({ ...club, ...punt });
    }
    if ((i + 1) % 25 === 0) console.log(`  … ${i + 1}/${teGeocoderen.length} verwerkt`);
  }

  const vandaag = new Date().toISOString().slice(0, 10);
  const regels = gevonden
    .slice()
    .sort((a, b) => a.plaats.localeCompare(b.plaats, "nl"))
    .map((c) => {
      const id = `meetandplay-${c.clubId}`;
      return (
        `  { id: ${JSON.stringify(id)}, naam: ${JSON.stringify(c.naam)}, plaats: ${JSON.stringify(c.plaats)}, ` +
        `banen: 0, systeem: "Meet & Play", ` +
        `status: ${JSON.stringify("Actief - boekbaar zonder lidmaatschap (steekproef van 4 clubs, niet individueel geverifieerd)")}, ` +
        `boekingsUrl: ${JSON.stringify(`https://meetandplay.nl/club/${c.clubId}`)}, ` +
        `adres: ${JSON.stringify(c.adres)}, lat: ${c.lat}, lon: ${c.lon}, coordinaatBron: "adres", ` +
        `boekbaarZonderLidmaatschap: true, meetAndPlayClubId: ${JSON.stringify(c.clubId)} },`
      );
    });

  const inhoud = `// AUTOMATISCH GEGENEREERD — niet met de hand aanpassen.
// Bron: meetandplay.nl/club (sportfilter Padel), één directory-pagina, geen
// paginering nodig. Coördinaten via de PDOK Locatieserver op basis van het
// adres uit de directory-kaart.
// Opnieuw genereren met: npm run discover:meetandplay
// Laatst gegenereerd: ${vandaag} — ${gevonden.length} clubs (${alle.length} in de directory, waarvan ${alle.length - teGeocoderen.length} al handmatig in clubs.ts staan).
//
// boekbaarZonderLidmaatschap: true is een AANNAME op basis van een steekproef
// van 4 handmatig geteste clubs (Hofgeest/Schoten/Groeneveen/Pim Mulier) — zie
// de docstring in scripts/discover-meetandplay-clubs.ts. Niet 401x individueel
// bevestigd.
import { Club } from "./types";

export type MeetAndPlayClub = Club & { meetAndPlayClubId: string };

export const MEETANDPLAY_CLUBS: MeetAndPlayClub[] = [
${regels.join("\n")}
];
`;

  const pad = "src/lib/clubs.meetandplay.ts";
  writeFileSync(pad, inhoud, "utf8");
  console.log(`\n${gevonden.length} clubs weggeschreven naar ${pad}.`);
  if (overgeslagen.length > 0) {
    console.log(`\nOvergeslagen (${overgeslagen.length}):`);
    for (const o of overgeslagen) console.log(`  - ${o}`);
  }
}

main().catch((err) => {
  console.error("Ontdekken mislukt:", err);
  process.exit(1);
});
