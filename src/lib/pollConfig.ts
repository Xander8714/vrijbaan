import { FOYS_CLUBS } from "./clubs.foys";
import { PLAYTOMIC_CLUBS } from "./clubs.playtomic";

/**
 * Koppelt een club-id (uit clubs.ts) aan de manier waarop we 'm kunnen pollen.
 * Clubs die hier niet in staan, worden overgeslagen door de polling-job —
 * ofwel omdat het boekingssysteem nog niet bevestigd is, ofwel (Overhout)
 * omdat het systeem wel bevestigd is maar een ingelogde sessie vereist,
 * wat een normale polling-job niet heeft (zie PROJECTPLAN.md §7).
 */
export type PollBron =
  | { type: "meetandplay"; meetAndPlayClubId: string }
  // Playtomic wordt gescraped op de publieke clubpagina (playtomic.com/clubs/<slug>),
  // niet meer via de dode `api.playtomic.io`-endpoint. tenantId staat er alleen
  // nog bij als referentie: die is nodig zodra we ooit Route A (officiële
  // third-party API met Bearer-token per club) gaan gebruiken.
  | { type: "playtomic"; slug: string; tenantId: string }
  | { type: "foys"; locationId: string };

// Alle 26 Peakz-vestigingen in één keer. Dat is goedkoop ondanks het aantal:
// de Foys-API geeft per datum álle vestigingen in één antwoord, en
// src/lib/scrapers/foys.ts cachet dat per datum binnen de run — dus 26 clubs
// kosten één HTTP-call per dag, niet 26.
const FOYS_BRONNEN: Record<string, PollBron> = Object.fromEntries(
  FOYS_CLUBS.map((club) => [club.id, { type: "foys", locationId: club.foysLocationId } as PollBron])
);

/**
 * De ontdekte Playtomic-clubs (scripts/discover-playtomic-clubs.ts).
 *
 * ⚠️ LET OP DE KOSTEN: anders dan Foys — waar één HTTP-call álle vestigingen
 * bedient — kost elke Playtomic-club een eigen Playwright-run van ~15-20
 * seconden. Met 80+ clubs × 3 dagen is één volledige polling-ronde daarmee ruim
 * een uur. Dat is niet houdbaar voor een cyclus van 5-10 minuten. Voordat dit
 * echt aan staat moet poll-availability.ts selectief worden: alleen clubs die
 * iemand volgt, plus een roulerend restje. Zie de takenlijst.
 */
const PLAYTOMIC_BRONNEN: Record<string, PollBron> = Object.fromEntries(
  PLAYTOMIC_CLUBS.map((club) => [
    club.id,
    { type: "playtomic", slug: club.playtomicSlug, tenantId: "" } as PollBron,
  ])
);

export const POLL_CONFIG: Record<string, PollBron> = {
  ...PLAYTOMIC_BRONNEN,
  hofgeest: { type: "meetandplay", meetAndPlayClubId: "29942" },
  // Beide Playtomic-clubs zijn op 29 juli 2026 end-to-end geverifieerd met
  // scripts/scrape-playtomic.ts: WePadel gaf 419 sloten / 27 starttijden en
  // PADEL25 19 sloten / 7 starttijden voor 30 juli 2026.
  wepadel: { type: "playtomic", slug: "wepadel-haarlem", tenantId: "dd28050e-35c4-4bd0-ab58-b2f88111846d" },
  padel25: { type: "playtomic", slug: "indoor-padel25-haarlem", tenantId: "68640cb4-c026-4bb1-8184-6e2cfe0f5ccf" },
  ...FOYS_BRONNEN,
  // overhout: NIET opgenomen — Baanreserveren vereist een ingelogde sessie
  // (zie API_REQUIREMENTS.md §4), dus geen simpele publieke poll mogelijk.
};
