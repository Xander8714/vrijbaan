/**
 * KNLTB speelsterkte via de publieke spelerszoeker op toernooi.nl — dit is
 * een ANDERE, publieke tak van het KNLTB-platform dan MijnKNLTB
 * (mijnknltb.toernooi.nl), dat een persoonlijke login vereist en dus bewust
 * niet geautomatiseerd wordt (zie PROJECTPLAN.md §7). Hier is geen login
 * nodig — alleen een bondsnummer.
 *
 * GEVERIFIEERD (23 juli 2026):
 * - Zoeken: GET https://www.toernooi.nl/find/player?q=<bondsnummer>.
 * - LET OP: dit is een SUBSTRING-match, geen exacte match — zoeken op
 *   "00000000" gaf 34 resultaten (elk bondsnummer dat die cijfers ergens
 *   bevat), niet per se de speler met exact dat bondsnummer. Elke
 *   resultaatregel toont het echte bondsnummer tussen haakjes naast de naam
 *   — dit script filtert daarop en pakt NOOIT zomaar de eerste hit, anders
 *   loop je het risico de rating van een andere speler te tonen.
 * - Een kale `fetch()` (zonder browser/cookies) krijgt een cookiewall-
 *   interstitial terug i.p.v. de echte pagina — vandaar Playwright i.p.v.
 *   een lichte HTTP-client.
 * - Op het spelersprofiel: naam staat in `h2.hgroup__heading`; de twee
 *   speelsterkte-badges zitten in een element met `title="Enkel"` resp.
 *   `title="Dubbel"`, met de waarde in een geneste `.tag-duo__title`.
 * - Op de resultatenlijst: elke rij is een `div.media__content` met
 *   `h5.media__title` (naam in `.nav-link__value`, bondsnummer in
 *   `.media__title-aside` als "(nummer)") en de club in
 *   `.media__content-subinfo .media__subheading .nav-link__value`. Gebruik
 *   deze structuur, niet losse tekst-regex op de hele rij — namen met een
 *   tussenvoegsel tussen haakjes (bv. "A.C. (Ineke) Jansen") laten een
 *   naïeve `/\(...\)/`-regex over de hele rijtekst het verkeerde stuk pakken.
 */

import { chromium } from "playwright";

export type KnltbSpeelsterkte = {
  bondsnummer: string;
  naam: string;
  enkel: number | null;
  dubbel: number | null;
};

export type KnltbZoekresultaat = {
  bondsnummer: string;
  naam: string;
  club: string | null;
};

/**
 * Vrij zoeken op naam (de site filtert NIET op woonplaats/club — dat veld
 * doorzoekt alleen namen, zie docstring hierboven). Geeft een lijst
 * kandidaten terug (naam + club, zodat de gebruiker zelf de juiste kan
 * herkennen aan de clubnaam) i.p.v. één automatische match zoals bij een
 * bondsnummer.
 */
export async function zoekKnltbSpelers(query: string, limiet = 15): Promise<KnltbZoekresultaat[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`https://www.toernooi.nl/find/player?q=${encodeURIComponent(query)}`, {
      waitUntil: "networkidle",
    });

    const cookieAccept = page.getByRole("button", { name: /accepteren|akkoord/i }).first();
    if (await cookieAccept.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieAccept.click();
      await page.waitForLoadState("networkidle");
    }

    return await page.evaluate((max) => {
      const rijen = Array.from(document.querySelectorAll(".media__content"));
      const resultaten: { bondsnummer: string; naam: string; club: string | null }[] = [];
      for (const rij of rijen) {
        const naam = rij.querySelector("h5.media__title .nav-link__value")?.textContent?.trim();
        const bondsnummerRuw = rij.querySelector("h5.media__title .media__title-aside")?.textContent?.trim();
        const bondsnummer = bondsnummerRuw?.replace(/[()]/g, "");
        if (!naam || !bondsnummer) continue;
        const club = rij.querySelector(".media__subheading .nav-link__value")?.textContent?.trim() ?? null;
        resultaten.push({ bondsnummer, naam, club });
        if (resultaten.length >= max) break;
      }
      return resultaten;
    }, limiet);
  } finally {
    await browser.close();
  }
}

export async function zoekKnltbSpeelsterkte(bondsnummer: string): Promise<KnltbSpeelsterkte> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`https://www.toernooi.nl/find/player?q=${encodeURIComponent(bondsnummer)}`, {
      waitUntil: "networkidle",
    });

    // Cookiewall kan bij een "koude" sessie verschijnen — sluit 'm indien aanwezig.
    const cookieAccept = page.getByRole("button", { name: /accepteren|akkoord/i }).first();
    if (await cookieAccept.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieAccept.click();
      await page.waitForLoadState("networkidle");
    }

    // De zoekfunctie doet een substring-match (zie docstring) — loop alle
    // resultaten af en pak alleen de rij met een EXACT overeenkomend
    // bondsnummer tussen haakjes, niet zomaar de eerste hit.
    const href = await page.evaluate((zoekNummer) => {
      const rijen = Array.from(document.querySelectorAll(".media__content"));
      for (const rij of rijen) {
        const bondsnummerRuw = rij.querySelector("h5.media__title .media__title-aside")?.textContent?.trim();
        const bondsnummer = bondsnummerRuw?.replace(/[()]/g, "");
        if (bondsnummer === zoekNummer) {
          return rij.querySelector("h5.media__title a")?.getAttribute("href") ?? null;
        }
      }
      return null;
    }, bondsnummer);

    if (!href) {
      throw new Error(`Geen speler gevonden met exact bondsnummer ${bondsnummer} (substring-matches uitgesloten).`);
    }

    await page.goto(new URL(href, "https://www.toernooi.nl").toString(), { waitUntil: "networkidle" });

    const naam = (await page.locator("h2.hgroup__heading").first().textContent())?.trim() ?? bondsnummer;

    const leesBadge = async (titel: string): Promise<number | null> => {
      const tekst = await page
        .locator(`[title="${titel}"] .tag-duo__title`)
        .first()
        .textContent()
        .catch(() => null);
      // parseFloat, niet parseInt — speelsterkte kent tot 1 cijfer achter de komma (bv. "6.5").
      const getal = tekst ? parseFloat(tekst.trim().replace(",", ".")) : NaN;
      return Number.isNaN(getal) ? null : getal;
    };

    const [enkel, dubbel] = await Promise.all([leesBadge("Enkel"), leesBadge("Dubbel")]);

    return { bondsnummer, naam, enkel, dubbel };
  } finally {
    await browser.close();
  }
}

// CLI: npx tsx src/lib/scrapers/knltb.ts <bondsnummer>
if (require.main === module) {
  const bondsnummer = process.argv[2];
  if (!bondsnummer) {
    console.error("Gebruik: npx tsx src/lib/scrapers/knltb.ts <bondsnummer>");
    process.exit(1);
  }
  zoekKnltbSpeelsterkte(bondsnummer)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((err) => {
      console.error("Opzoeken mislukt:", (err as Error).message);
      process.exit(1);
    });
}
