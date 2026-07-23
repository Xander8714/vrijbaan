/**
 * Koppelt een club-id (uit clubs.ts) aan de manier waarop we 'm kunnen pollen.
 * Clubs die hier niet in staan, worden overgeslagen door de polling-job —
 * ofwel omdat het boekingssysteem nog niet bevestigd is, ofwel (Overhout)
 * omdat het systeem wel bevestigd is maar een ingelogde sessie vereist,
 * wat een normale polling-job niet heeft (zie PROJECTPLAN.md §7).
 */
export type PollBron =
  | { type: "meetandplay"; meetAndPlayClubId: string }
  | { type: "playtomic"; tenantId: string }
  | { type: "foys"; locationId: string; reservationTypeId: number };

export const POLL_CONFIG: Record<string, PollBron> = {
  hofgeest: { type: "meetandplay", meetAndPlayClubId: "29942" },
  wepadel: { type: "playtomic", tenantId: "dd28050e-35c4-4bd0-ab58-b2f88111846d" },
  padel25: { type: "playtomic", tenantId: "68640cb4-c026-4bb1-8184-6e2cfe0f5ccf" },
  // overhout: NIET opgenomen — Baanreserveren vereist een ingelogde sessie
  // (zie API_REQUIREMENTS.md §3), dus geen simpele publieke GET-poll mogelijk.
  // peakz: NIET opgenomen (23 juli 2026) — fetchFoysAvailability() is nog een
  // stub die altijd gooit (zie src/lib/scrapers/foys.ts), dus dit faalt
  // gegarandeerd bij elke poll. Zet terug zodra die scraper echt werkt:
  // peakz: { type: "foys", locationId: "527bd7b9-d8d3-4c43-a2cb-997e5baa0527", reservationTypeId: 6 },
};
