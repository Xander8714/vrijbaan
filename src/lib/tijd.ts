/**
 * Tijd- en dagrekenwerk voor de Radar-filters.
 *
 * Waarom apart: het filteren op "rond 19:00, plus of min 2 uur" is precies het
 * soort logica dat er in de UI simpel uitziet en stil verkeerd gaat (23:00 + 2
 * uur, of een club die om 07:00 opent terwijl je 06:00 zoekt). Als losse pure
 * functies is het te testen zonder een browser.
 */

/**
 * Aantal dagen dat de Radar vooruit kijkt (vandaag t/m 6 dagen later — een
 * week). Was 3 (vandaag/morgen/overmorgen); opgehoogd 31 juli 2026 op
 * verzoek van Xander ("ook een week vooruit kunnen boeken"), onderbouwd met
 * onderzoek naar gangbare boekvensters: Playtomic-clubs zetten hun agenda
 * doorgaans 7-14 dagen vooruit open (bv. Apeldoorn Padel, Deventer Padel:
 * 14 dagen; Padeldam: 21 dagen), en de industrienorm voor "ver genoeg om een
 * weekend te plannen, niet zo ver dat het merendeel nog leeg/onzeker is" ligt
 * rond de 7-14 dagen. 7 is de conservatieve keuze — ruim genoeg voor een
 * week vooruit boeken, zonder een agenda te suggereren die verder reikt dan
 * onze eigen bronnen (Meet & Play, Foys) doorgaans al open hebben staan.
 *
 * Dit is UITSLUITEND het live-opgehaalde venster op de Radar-pagina
 * (/api/beschikbaarheid, on-demand per bezoek — geen extra doorlopende
 * kosten). De achtergrond-poller (scripts/poll-availability.ts, voor
 * Telegram-notificaties) heeft een EIGEN, kleinere DAGEN_VOORUIT en is
 * bewust NIET meegehoogd: een notificatie is pas nuttig bij een vrijgekomen
 * plek (annulering), en die gebeuren vrijwel altijd kort vóór de speeldag —
 * ver-vooruit-dagen zijn bij de eerste meting al vol of leeg en leveren dus
 * zelden een "nieuw vrijgekomen slot"-notificatie op, terwijl elke extra dag
 * wél een volledige Playwright-run per club kost (zie de docstring daar).
 */
export const DAGEN_VOORUIT = 7;

const TIJD_RE = /^(\d{1,2}):(\d{2})$/;

/** "19:00" → 1140 minuten na middernacht. null bij een ongeldige tijd. */
export function naarMinuten(tijd: string): number | null {
  const m = TIJD_RE.exec(tijd.trim());
  if (!m) return null;
  const uren = Number(m[1]);
  const minuten = Number(m[2]);
  if (uren > 23 || minuten > 59) return null;
  return uren * 60 + minuten;
}

/**
 * Valt `tijd` binnen `margeUren` rond `voorkeur`?
 *
 * Bewust géén doorloop over middernacht: een padelbaan om 01:00 is geen
 * redelijk alternatief voor een voorkeur van 23:00, en clubs sluiten toch rond
 * 23:00. Wél netjes afgekapt, dus 22:00 ± 2 uur vindt gewoon 20:00 t/m 23:00
 * zonder om te slaan naar de volgende ochtend.
 */
export function binnenTijdvenster(tijd: string, voorkeur: string, margeUren: number): boolean {
  const t = naarMinuten(tijd);
  const v = naarMinuten(voorkeur);
  if (t === null || v === null) return false;
  return Math.abs(t - v) <= margeUren * 60;
}

/** De komende dagen als ISO-datums (YYYY-MM-DD), vandaag eerst. */
export function komendeDagen(aantal: number = DAGEN_VOORUIT, vanaf: Date = new Date()): string[] {
  return Array.from({ length: aantal }, (_, i) => {
    const d = new Date(vanaf);
    d.setDate(d.getDate() + i);
    // Lokale datum, niet toISOString(): die rekent naar UTC en zou in de
    // Nederlandse zomertijd 's avonds de verkeerde dag opleveren.
    const maand = String(d.getMonth() + 1).padStart(2, "0");
    const dag = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${maand}-${dag}`;
  });
}

/** "Vandaag" / "Morgen" / "Overmorgen", anders een korte Nederlandse datum. */
export function dagLabel(isoDatum: string, dagenVanafVandaag: number): string {
  if (dagenVanafVandaag === 0) return "Vandaag";
  if (dagenVanafVandaag === 1) return "Morgen";
  if (dagenVanafVandaag === 2) return "Overmorgen";
  const [jaar, maand, dag] = isoDatum.split("-").map(Number);
  return new Date(jaar, maand - 1, dag).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}
