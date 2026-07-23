/**
 * Foys (boekingssysteem van Peakz Padel Haarlem) — nog NIET geïmplementeerd.
 *
 * Peakz staat al in src/lib/pollConfig.ts (locationId + reservationTypeId
 * bevestigd via live Chrome-inspectie), maar de daadwerkelijke scraper/client
 * voor Foys is nog niet gebouwd — dit ontbrak nog aan verificatie/onderzoek
 * op het moment dat de polling-laag werd opgezet. scripts/poll-availability.ts
 * vangt deze fout per club/dag op en gaat door met de andere clubs.
 *
 * Aanvullend bevestigd (23 juli 2026, live netwerk-inspectie van
 * https://www.peakzpadel.nl/reserveren/court-booking/reservation):
 * - Endpoint: `GET https://api.foys.io/court-booking/public/api/v1/locations/search`
 *   — 200 OK zonder Authorization-header, dus publiek bereikbaar.
 * - Query: `reservationTypeId=6` (padel), `locationId=527bd7b9-d8d3-4c43-a2cb-997e5baa0527`,
 *   herhaalde `playingTimes[]` (60/90/120 min), `date=YYYY-MM-DDT00:00`.
 * - `locationId` bevestigd als "Haarlemmerstroom" — dit is de enige Peakz-vestiging
 *   onder stad "Haarlem" in hun eigen locatiekiezer.
 * - ⚠️ Discrepantie gezien: een losse `fetch()` op exact deze URL (vanuit dezelfde
 *   paginacontext, dus geen CORS-probleem) gaf `[]` terug, terwijl de pagina op
 *   hetzelfde moment wél tijdsloten met prijzen toonde (sommige doorgestreept =
 *   bezet). Waarschijnlijk stuurt de frontend een extra header/cookie mee
 *   (sessie, csrf, of iets als `X-Requested-With`) die een kale fetch mist.
 *   Neem de exacte request-headers uit de browser-devtools over en vergelijk
 *   de ruwe JSON-vorm voordat je de implementatie hieronder invult.
 */
export type FoysSlot = { startTime: string };

export async function fetchFoysAvailability(
  locationId: string,
  reservationTypeId: number,
  datum: string
): Promise<FoysSlot[]> {
  throw new Error(
    `Foys-scraper nog niet geïmplementeerd (locationId=${locationId}, ` +
      `reservationTypeId=${reservationTypeId}, datum=${datum}). Zie API_REQUIREMENTS.md voor de status van Peakz/Foys.`
  );
}
