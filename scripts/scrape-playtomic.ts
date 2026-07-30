/**
 * Playtomic beschikbaarheid via headless browser (Playwright).
 *
 * WAAROM GEEN LOSSE FETCH: het onofficiële `api.playtomic.io/v1/availability`
 * endpoint is dood — CloudFront 403 vanaf elke geteste verbinding, ook een
 * gewone Chrome-sessie (zie src/lib/scrapers/playtomic.ts en
 * API_REQUIREMENTS.md §1). De data staat wél gewoon in de gerenderde pagina op
 * `playtomic.com/clubs/<slug>`, dus dit werkt net als bij Meet & Play: pagina
 * echt laden en het rooster uitlezen.
 *
 * GEVERIFIEERD END-TO-END (29 juli 2026, tegen wepadel-haarlem):
 * - Datum via URL:  `?date=YYYY-MM-DD` werkt. Bevestigd doordat de pagina bij
 *                   `?date=2026-07-30` overal het label "do 30 jul" toont.
 * - MOBIELE weergave gebruiken, niet de desktop. Het desktoprooster is
 *   absoluut gepositioneerd (slots als <div style="left:6.25%">), dus daar
 *   staat de starttijd alleen impliciet in percentages. De mobiele weergave
 *   (`div.block.md:hidden`) rendert de tijden als tekst. Daarom zet dit script
 *   een mobiele viewport.
 * - Per baan:   `details[class*="group/resource"]`, met in de <summary> de
 *               baannaam + bv. "44 options•Starting at 07:00 until 22:00".
 * - Per tijd:   daarbinnen `details[class*="group/slot"]`; de <summary> begint
 *               met de starttijd ("07:00") gevolgd door "3 options".
 * - Per optie:  in `div.border-primary-7` regels als
 *               "07:00 - 08:00•60 min•€ 27,00" + een "Book"-knop.
 * - <details> staan dicht; dit script zet ze in twee rondes open (de tweede
 *   ronde pakt de slot-details die pas verschijnen nadat hun baan open is).
 *
 * BELANGRIJKE VAL (zelfde als bij Meet & Play): een leeg resultaat is niet per
 * se een kapotte scraper. Op 29 juli 2026 ~22:00 gaf WePadel voor alle 8 banen
 * "No slots available" — geldig, want de laatste boekbare tijd was verstreken.
 * Dezelfde club voor morgen opvragen gaf 44-69 opties per baan. Verifieer
 * twijfel dus altijd met een dag vooruit voordat je de selectors verdenkt.
 *
 * Gebruik:
 *   npx tsx scripts/scrape-playtomic.ts wepadel-haarlem
 *   npx tsx scripts/scrape-playtomic.ts indoor-padel25-haarlem 2026-07-30
 */

import { chromium } from "playwright";

export type PlaytomicSlot = {
  startTime: string; // "HH:MM"
  baan: string;
  duurMinuten: number | null;
  prijs: string | null; // zoals Playtomic het toont, bv. "€ 27,00"
};

export type PlaytomicResultaat = {
  slug: string;
  datum: string; // YYYY-MM-DD, de opgevraagde datum
  slots: PlaytomicSlot[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function vandaagISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * De uitleesfunctie staat bewust als STRING en niet als TypeScript-callback.
 * Via `npx tsx` compileert esbuild binnenfuncties met een `__name`-helper die
 * in de paginacontext niet bestaat — dat geeft "ReferenceError: __name is not
 * defined" zodra je een genest arrow-function in page.evaluate gebruikt.
 * (Vastgesteld op 29 juli 2026 bij het bouwen van dit script.)
 */
const OPEN_ALLE_DETAILS_JS = `(() => {
  var d = Array.prototype.slice.call(document.querySelectorAll("details"));
  d.forEach(function (el) { if (!el.open) el.open = true; });
  return d.length;
})()`;

const LEES_SLOTEN_JS = `(() => {
  var uit = [];
  var banen = Array.prototype.slice.call(document.querySelectorAll('details[class*="group/resource"]'));

  banen.forEach(function (baanEl) {
    var summary = baanEl.querySelector("summary");
    var baanNaam = "";
    if (summary) {
      // Eerste regel van de summary is de baannaam; daarna volgt
      // "N options•Starting at ...".
      baanNaam = (summary.innerText || "").split("\\n")[0].trim();
    }

    var tijdBlokken = Array.prototype.slice.call(baanEl.querySelectorAll('details[class*="group/slot"]'));
    tijdBlokken.forEach(function (tijdEl) {
      var tijdSummary = tijdEl.querySelector("summary");
      var tijdTekst = (tijdSummary && tijdSummary.innerText) || "";
      var m = /(\\d{1,2}:\\d{2})/.exec(tijdTekst);
      if (!m) return;
      var startTime = m[1].length === 4 ? "0" + m[1] : m[1];

      var opties = Array.prototype.slice.call(tijdEl.querySelectorAll("div"))
        .map(function (d) { return (d.textContent || "").trim(); })
        .filter(function (t) { return /\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2}/.test(t) && /min/.test(t); });

      if (opties.length === 0) {
        uit.push({ startTime: startTime, baan: baanNaam, duurMinuten: null, prijs: null });
        return;
      }

      // Per unieke duur één regel; dezelfde tekst komt meermaals voor doordat
      // de opsomming genest in meerdere divs staat.
      var gezien = {};
      opties.forEach(function (tekst) {
        var duur = /(\\d+)\\s*min/.exec(tekst);
        var prijs = /((?:€|EUR)\\s*[\\d.,]+)/.exec(tekst);
        var duurMin = duur ? parseInt(duur[1], 10) : null;
        var sleutel = startTime + "|" + duurMin;
        if (gezien[sleutel]) return;
        gezien[sleutel] = true;
        uit.push({
          startTime: startTime,
          baan: baanNaam,
          duurMinuten: duurMin,
          prijs: prijs ? prijs[1].replace(/\\s+/g, " ").trim() : null
        });
      });
    });
  });

  return uit;
})()`;

export async function scrapePlaytomic(
  slug: string,
  datum: string = vandaagISO()
): Promise<PlaytomicResultaat> {
  if (!ISO_DATE_RE.test(datum)) {
    throw new Error(`Ongeldige datum "${datum}" — gebruik YYYY-MM-DD.`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    // Mobiele context: alleen dan rendert Playtomic de tijden als tekst.
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

    const url = `https://playtomic.com/clubs/${slug}?date=${datum}`;
    const respons = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (respons && respons.status() >= 400) {
      throw new Error(`Playtomic gaf ${respons.status()} voor ${url} — bestaat de slug nog?`);
    }

    // Cookiebanner kan over het rooster liggen. Alleen wegklikken als hij er is.
    const cookieKnop = page.getByRole("button", { name: /accept all/i });
    if (await cookieKnop.isVisible({ timeout: 4000 }).catch(() => false)) {
      await cookieKnop.click().catch(() => {});
    }

    await page.waitForSelector('details[class*="group/resource"]', { timeout: 20000 });

    // Twee rondes: de slot-details bestaan pas nadat hun baan open staat.
    await page.evaluate(OPEN_ALLE_DETAILS_JS);
    await page.waitForTimeout(1200);
    await page.evaluate(OPEN_ALLE_DETAILS_JS);
    await page.waitForTimeout(800);

    const slots = (await page.evaluate(LEES_SLOTEN_JS)) as PlaytomicSlot[];
    return { slug, datum, slots };
  } finally {
    await browser.close();
  }
}

/** Unieke starttijden, gesorteerd — wat de polling-laag nodig heeft. */
export function uniekeStarttijden(resultaat: PlaytomicResultaat): { startTime: string }[] {
  const set = new Set(resultaat.slots.map((s) => s.startTime));
  return [...set].sort().map((startTime) => ({ startTime }));
}

// CLI: npx tsx scripts/scrape-playtomic.ts <slug> [YYYY-MM-DD]
if (require.main === module) {
  const slug = process.argv[2] ?? "wepadel-haarlem";
  const datum = process.argv[3];
  scrapePlaytomic(slug, datum)
    .then((resultaat) => {
      console.log(
        JSON.stringify(
          {
            ...resultaat,
            aantalSlots: resultaat.slots.length,
            starttijden: uniekeStarttijden(resultaat).map((s) => s.startTime),
          },
          null,
          2
        )
      );
    })
    .catch((err) => {
      console.error("Scrapen mislukt:", err);
      process.exit(1);
    });
}
