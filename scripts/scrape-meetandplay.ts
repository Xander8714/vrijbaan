/**
 * Meet & Play (KNLTB) beschikbaarheid via headless browser (Playwright).
 *
 * WAAROM GEEN LOSSE FETCH: de site draait op Laravel Livewire. Elke
 * filterwijziging stuurt een POST naar /livewire/update met een interne
 * component-snapshot + CSRF-token — geen stabiele publieke JSON-API zoals
 * bij Playtomic. De enige betrouwbare aanpak is de pagina echt laden en
 * bedienen zoals een gebruiker dat doet.
 *
 * GEVERIFIEERDE SELECTORS (via devtools/JS-inspectie op Hofgeest, club 29942):
 * - Sportfilter:   select#sportId  (wire:model.live="tenantSportId")
 *                  option value="1" = Tennis, value="2" = Padel
 * - Tijdslots:     input[name="time"]  → .value is de starttijd, bv. "08:00"
 *                  (gerenderd binnen <div class="mp-page-filters-time">)
 *
 * NOG NIET GEVERIFIEERD:
 * - De datumkiezer (geen native <input type="date"> gevonden — vermoedelijk
 *   een custom widget). Dit script gebruikt daarom standaard de datum van
 *   vandaag (wat de pagina zonder ingrijpen al toont). Datumnavigatie is de
 *   volgende stap zodra je dit script lokaal kunt draaien en de datum-UI
 *   kunt inspecteren.
 * - NIET GETEST IN DEZE SANDBOX: netwerk-allowlist blokkeerde de download
 *   van de Chromium-browser hier. Draai dit een keer lokaal om te bevestigen.
 *
 * Gebruik:
 *   npx tsx scripts/scrape-meetandplay.ts 29942
 */

import { chromium } from "playwright";

export type MeetAndPlaySlot = {
  startTime: string; // bv. "19:00"
};

export type MeetAndPlayResultaat = {
  clubId: string;
  datum: string; // YYYY-MM-DD, zoals getoond door de pagina op moment van scrapen
  slots: MeetAndPlaySlot[];
};

export async function scrapeMeetAndPlay(clubId: string): Promise<MeetAndPlayResultaat> {
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

    // Geef de DOM even tijd om na de Livewire-response te her-renderen.
    await page.waitForTimeout(500);

    const startTimes = await page.$$eval('input[name="time"]', (inputs) =>
      inputs.map((el) => (el as HTMLInputElement).value)
    );

    return {
      clubId,
      datum: new Date().toISOString().slice(0, 10),
      slots: startTimes.map((startTime) => ({ startTime })),
    };
  } finally {
    await browser.close();
  }
}

// CLI: node/tsx scripts/scrape-meetandplay.ts <clubId>
if (require.main === module) {
  const clubId = process.argv[2] ?? "29942";
  scrapeMeetAndPlay(clubId)
    .then((resultaat) => {
      console.log(JSON.stringify(resultaat, null, 2));
    })
    .catch((err) => {
      console.error("Scrapen mislukt:", err);
      process.exit(1);
    });
}
