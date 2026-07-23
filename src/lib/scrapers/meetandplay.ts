/**
 * Meet & Play (KNLTB) beschikbaarheid — app-facing interface.
 *
 * De daadwerkelijke scraper staat in scripts/scrape-meetandplay.ts en draait
 * via Playwright (headless browser) — dat kan niet in een gewone Next.js
 * request/response cyclus (te traag, vereist een browser-binary). Dit hoort
 * dus als losse polling-job te draaien (bv. elke 5-10 min via een cron/worker
 * process, zie PROJECTPLAN.md), die het resultaat in de database zet. Deze
 * functie hier is de interface die de rest van de app aanroept om de laatst
 * opgehaalde data te lezen — niet om live te scrapen tijdens een pageview.
 *
 * Zie API_REQUIREMENTS.md en scripts/scrape-meetandplay.ts voor de volledige
 * technische uitleg en geverifieerde selectors.
 */

export type MeetAndPlaySlot = {
  startTime: string; // bv. "19:00"
};

export async function fetchMeetAndPlayAvailability(
  clubId: string,
  date: string // YYYY-MM-DD
): Promise<MeetAndPlaySlot[]> {
  throw new Error(
    "Nog niet gekoppeld aan een database. De scraper zelf werkt " +
    "(scripts/scrape-meetandplay.ts, geverifieerde selectors) maar moet nog " +
    "als losse polling-job draaien die resultaten opslaat — deze functie " +
    "moet die opgeslagen data uitlezen, niet live scrapen."
  );
}
