/**
 * Meet & Play (KNLTB) beschikbaarheid via headless browser (Playwright).
 *
 * WAAROM GEEN LOSSE FETCH: de site draait op Laravel Livewire. Elke
 * filterwijziging stuurt een POST naar /livewire/update met een interne
 * component-snapshot + CSRF-token — geen stabiele publieke JSON-API zoals
 * bij Playtomic. De enige betrouwbare aanpak is de pagina echt laden en
 * bedienen zoals een gebruiker dat doet.
 *
 * GEVERIFIEERD END-TO-END (23 juli 2026, tegen Hofgeest / club 29942):
 * - Sportfilter:   select#sportId  (wire:model.live="tenantSportId")
 *                  option value="1" = Tennis, value="2" = Padel
 * - Tijdslots:     input[name="time"]  → .value is de starttijd, bv. "08:00"
 *                  (gerenderd binnen <div class="mp-page-filters-time">)
 * - Datumkiezer:   #date is een READONLY input bediend door een Pikaday-
 *                  widget (wire:ignore, dus Livewire rendert 'm niet zelf om).
 *                  Pikaday's onSelect-callback roept handmatig
 *                  `window.Livewire.find(<wireId>).set('date', 'DD-MM-YYYY')`
 *                  aan — er is geen native <input type="date">. Dit script
 *                  roept exact diezelfde Livewire-call aan i.p.v. de
 *                  kalender-UI te bedienen (stabieler: geen popup-positionering
 *                  of maand-navigatie nodig). minDate staat op "vandaag";
 *                  dagen in het verleden opvragen levert een foutmelding.
 *
 * BELANGRIJKE VAL: een lege slots-array betekent niet per se een kapotte
 * scraper — laat op de avond (na sluitingstijd/laatste boekbare slot) is een
 * lege lijst voor "vandaag" een geldig, echt resultaat. Geverifieerd door
 * dezelfde club voor "morgen" op te vragen: die gaf gewoon 21 sloten terug.
 *
 * Gebruik:
 *   npx tsx scripts/scrape-meetandplay.ts 29942
 *   npx tsx scripts/scrape-meetandplay.ts 29942 2026-07-24
 */

import { chromium } from "playwright";

export type MeetAndPlaySlot = {
  startTime: string; // bv. "19:00"
};

export type MeetAndPlayResultaat = {
  clubId: string;
  datum: string; // YYYY-MM-DD, de opgevraagde datum
  slots: MeetAndPlaySlot[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function toNLDate(isoDatum: string): string {
  const [jaar, maand, dag] = isoDatum.split("-");
  return `${dag}-${maand}-${jaar}`;
}

export async function scrapeMeetAndPlay(
  clubId: string,
  datum: string = todayISO() // YYYY-MM-DD
): Promise<MeetAndPlayResultaat> {
  if (!ISO_DATE_RE.test(datum)) {
    throw new Error(`Ongeldige datum "${datum}" — gebruik YYYY-MM-DD.`);
  }
  if (datum < todayISO()) {
    throw new Error(`Datum ${datum} ligt in het verleden — Meet & Play staat alleen vandaag of later toe.`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`https://meetandplay.nl/club/${clubId}`, { waitUntil: "networkidle" });

    // Cookiebot-banner kan de pagina blokkeren — accepteer indien aanwezig.
    const cookieAccept = page.locator("#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll");
    if (await cookieAccept.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieAccept.click();
    }

    // Zet sportfilter op Padel (waarde "2") en wacht op de Livewire-update.
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("/livewire/update"), { timeout: 10000 }),
      page.selectOption("#sportId", "2"),
    ]);
    await page.waitForTimeout(500);

    // Alleen navigeren als er een andere dag dan vandaag is opgevraagd —
    // de pagina toont "vandaag" al zonder ingrijpen.
    if (datum !== todayISO()) {
      const wireId = await page.evaluate(() => {
        const dateInput = document.querySelector("#date");
        return dateInput?.closest("[wire\\:id]")?.getAttribute("wire:id") ?? null;
      });
      if (!wireId) {
        throw new Error("Kon het Livewire-component voor de datumkiezer (#date) niet vinden.");
      }

      await Promise.all([
        page.waitForResponse((res) => res.url().includes("/livewire/update"), { timeout: 10000 }),
        page.evaluate(
          ({ wireId, nlDatum }) => {
            // @ts-expect-error window.Livewire wordt door meetandplay.nl zelf geinjecteerd
            return window.Livewire.find(wireId).set("date", nlDatum);
          },
          { wireId, nlDatum: toNLDate(datum) }
        ),
      ]);
      await page.waitForTimeout(500);
    }

    const startTimes = await page.$$eval('input[name="time"]', (inputs) =>
      inputs.map((el) => (el as HTMLInputElement).value)
    );

    return {
      clubId,
      datum,
      slots: startTimes.map((startTime) => ({ startTime })),
    };
  } finally {
    await browser.close();
  }
}

// CLI: npx tsx scripts/scrape-meetandplay.ts <clubId> [YYYY-MM-DD]
if (require.main === module) {
  const clubId = process.argv[2] ?? "29942";
  const datum = process.argv[3]; // optioneel, default vandaag
  scrapeMeetAndPlay(clubId, datum)
    .then((resultaat) => {
      console.log(JSON.stringify(resultaat, null, 2));
    })
    .catch((err) => {
      console.error("Scrapen mislukt:", err);
      process.exit(1);
    });
}
