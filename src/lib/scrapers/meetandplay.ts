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
 * Status (23 juli 2026): scraper end-to-end geverifieerd tegen Hofgeest
 * (club 29942), inclusief datumnavigatie. Nog niet gekoppeld aan de polling-
 * laag/database — zie taak 3/4 in PROJECTPLAN.md.
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
    "Nog niet gekoppeld aan een database. De scraper zelf werkt end-to-end " +
    "(scripts/scrape-meetandplay.ts, geverifieerd incl. datumnavigatie) maar " +
    "moet nog als losse polling-job draaien die resultaten opslaat — deze " +
    "functie moet die opgeslagen data uitlezen, niet live scrapen."
  );
}
