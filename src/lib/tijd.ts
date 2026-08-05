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

/**
 * Verste dag die we nog WEL proberen te doorzoeken buiten de zichtbare
 * DAGEN_VOORUIT-knoppenrij om — deep links (Radar-URL's met een eigen
 * `datum`-parameter) en Telegram-zoekopdrachten met een expliciete
 * kalenderdatum ("zoek 19 augustus..."). 14, niet 7: zelfde Playtomic-
 * onderzoek als bij DAGEN_VOORUIT hierboven ("doorgaans 7-14 dagen vooruit
 * open") — de UI blijft bewust op 7 (conservatief or de standaardweergave),
 * maar een verzoek dat expliciet verder vooruit vraagt mag tot waar de
 * ruimste bronnen al reiken.
 *
 * Ontdekt als bug (5 aug 2026, Xander): een deep link naar +14 dagen
 * (2026-08-19 vanaf 5 aug) werd stilzwijgend GENEGEERD, omdat de oude check
 * `komendeDagen(14)` slechts 14 dagen *vanaf vandaag* teruggeeft — dag 0 t/m
 * 13, dus t/m 18 augustus, niet t/m 19. Vandaar hier +1: deze constante
 * betekent "dag+N mag nog", dus de lijst moet N+1 lang zijn om dag N zelf
 * ook echt te bevatten. Zie komendeDagen(MAX_DAGEN_VOORUIT_ZOEKEN + 1) in
 * radar/page.tsx en telegramConversatie.ts — beide gebruiken bewust
 * dezelfde constante, zodat de website en de Telegram-bot nooit een
 * ander antwoord geven op "hoe ver vooruit mag ik zoeken".
 */
export const MAX_DAGEN_VOORUIT_ZOEKEN = 14;

// De achtergrondpoller heeft alleen voor vandaag + 2 dagen een verse
// databasecache. Verder vooruit moet de Radar live scrapen; daarom begrenzen
// we daar de straal om een lange reeks browser-scrapes te voorkomen.
export const MAX_STRAAL_VER_VOORUIT_KM = 5;
const CACHE_VENSTER_DAGEN = 3;

export function begrensZoekstraalVoorDatum(
  straalKm: number,
  datum: string,
  vanaf: Date = new Date()
): number {
  return komendeDagen(CACHE_VENSTER_DAGEN, vanaf).includes(datum)
    ? straalKm
    : Math.min(straalKm, MAX_STRAAL_VER_VOORUIT_KM);
}

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
 * Rondt af naar het dichtstbijzijnde half uur — Xander (2 aug 2026): "geen
 * enkel boekingssysteem laat je op de minuut klikken, 90% is alleen heel/half
 * uur". Nodig omdat de `step="1800"` op het `<input type="time">` alleen de
 * stappentjes-pijltjes beperkt; veel mobiele tijdkiezers (met name iOS)
 * laten via het scrollwiel gewoon elke minuut kiezen ondanks die step.
 * Gebruikt zowel door de Radar-voorkeurstijd als de bot (extraheerTijd), zo
 * betekent "voorkeurstijd" overal in de app hetzelfde soort waarde.
 */
export function rondAfOpHalfUur(tijd: string): string | null {
  const minutenTotaal = naarMinuten(tijd);
  if (minutenTotaal === null) return null;
  const afgerond = (Math.round(minutenTotaal / 30) * 30) % (24 * 60);
  const uren = Math.floor(afgerond / 60);
  const minuten = afgerond % 60;
  return `${String(uren).padStart(2, "0")}:${String(minuten).padStart(2, "0")}`;
}

/**
 * Hele/halve uren van een dag als "07:00".."23:00" (standaard) — voor een
 * dropdown i.p.v. een vrij `<input type="time">`. Xander (3 aug 2026): "zorg
 * dat ik alleen per half uur of heel uur tijden kan kiezen, ik hoef niet
 * elke minuut weer te geven". `step="1800"` + achteraf afronden (zie
 * rondAfOpHalfUur hierboven) laat op sommige tijdkiezers nog steeds elke
 * minuut ZIEN, ook al werd de opgeslagen waarde alsnog afgerond — een
 * dropdown met alleen deze waarden maakt een minuutwaarde onmogelijk om te
 * kiezen i.p.v. hem achteraf te corrigeren.
 *
 * Standaard begrensd op 07:00-23:00 (Xander, 3 aug 2026: "geef niet weer
 * tussen 23:00 en 07:00, scheelt weer scrollen") — clubs sluiten toch rond
 * 23:00 (zie ook binnenTijdvenster hierboven), dus die uren zijn voor het
 * kiezen van een speeltijd altijd ruis.
 */
export function halfUurOpties(vanaf = "07:00", tot = "23:00"): string[] {
  const start = naarMinuten(vanaf) ?? 0;
  const eind = naarMinuten(tot) ?? 24 * 60 - 30;
  const opties: string[] = [];
  for (let m = start; m <= eind; m += 30) {
    opties.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return opties;
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
