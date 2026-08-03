/**
 * Gesprekslogica voor de Telegram-bot (2 aug 2026) — los van het
 * Telegram-protocol zelf (dat blijft in src/app/api/telegram/webhook), zodat
 * dit los te testen is. Twee gespreksvormen:
 *
 * 1. Onboarding (na het koppelen): "waar wil je padellen?" + "hoe laat?" —
 *    zet profiles.lat/lon/woonplaats/zoekstraal_km/voorkeurstijd, gebruikt
 *    door de achtergrond-poller voor toekomstige meldingen.
 * 2. Losse zoekopdracht in vrije tekst ("zoek een baan in Haarlem rond
 *    20:00") — direct een live antwoord met tijden, geen opgeslagen state.
 *
 * BELANGRIJKE BEPERKING (2 aug 2026, nog niet opgelost): losse
 * zoekopdrachten roepen /api/beschikbaarheid aan, en die route gebruikt voor
 * Playtomic/Meet & Play Playwright — wat op Vercel's serverless-omgeving
 * niet werkt (zelfde bevestigde oorzaak als de Radar-bug diezelfde dag).
 * Tot de scraper op een VPS draait, geeft een losse zoekopdracht dus alleen
 * betrouwbare tijden voor Foys/Peakz-clubs; andere clubs komen terug met
 * "Geen tijden geladen" en worden hier stilzwijgend overgeslagen (niet als
 * "geen plek" gemeld, dat zou onwaar zijn).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLUBS } from "./clubs";
import { binnenStraal, zoekLocatiesPdok, type Coordinaat, type GevondenLocatie } from "./geo";
import { binnenTijdvenster, dagLabel, naarMinuten, rondAfOpHalfUur } from "./tijd";
import { bouwSessieLink, maakInlogToken } from "./telegramSessie";

const STRAAL_ADHOC_KM = 10;
// Zelfde soort grens als MAX_CLUBS in src/app/api/beschikbaarheid/route.ts,
// hier kleiner gehouden: een chatbericht met 20 clubs is niet leesbaar, en
// elke Playtomic/Meet & Play-club in de lijst kost een aparte Playwright-run.
const MAX_CLUBS_ADHOC = 12;
const MAX_CLUBS_IN_BERICHT = 6;
const MARGE_UREN_ADHOC = 2;

export type Slot = { tijd: string; prijs: string | null };
type BeschikbaarheidRij = { clubId: string; sloten: Slot[]; fout?: string };

/**
 * Kiest welke dag een losse zoekopdracht bedoelt. Expliciete dagwoorden
 * ("morgen", "overmorgen", "vandaag") winnen altijd. Zonder zo'n woord: na
 * 21:00 automatisch morgen — zelfde regel als de Radar (Xander, 30 juli
 * 2026: "22:57 als voorkeurstijd voor morgen is zinloos"). Zonder dit zou
 * "zoek een baan in Haarlem rond 20:00" laat op de avond altijd "geen
 * plekken" opleveren, puur omdat alle tijden van vandaag al voorbij zijn —
 * precies de bug die Xander op 2 aug 2026 meldde.
 */
export function kiesZoekdatum(dagOffset: number | null): { datum: string; dagOffset: number } {
  const nu = new Date();
  const gekozenOffset = dagOffset ?? (nu.getHours() >= 21 ? 1 : 0);
  const d = new Date(nu);
  d.setDate(d.getDate() + gekozenOffset);
  const datum = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { datum, dagOffset: gekozenOffset };
}

// --- Locatiekandidaten voor een inline keyboard -----------------------

/** Telegram staat max. 64 bytes callback_data toe — een index naar de
 * tijdelijk opgeslagen kandidatenlijst past ruim, de kandidaten zelf niet. */
export function bouwLocatieKeyboard(kandidaten: GevondenLocatie[]) {
  return {
    inline_keyboard: kandidaten.map((k, i) => [
      { text: k.weergavenaam.slice(0, 60), callback_data: `loc:${i}` },
    ]),
  };
}

// --- Vrije-tekst-parsing voor losse zoekopdrachten ---------------------

const TIJD_PATRONEN = [
  /\b([01]?\d|2[0-3]):([0-5]\d)\b/, // 20:00, 8:30
  /\b([01]?\d|2[0-3])u([0-5]\d)\b/i, // 20u30
  /\b([01]?\d|2[0-3])u\b/i, // 20u
  /\b([01]?\d|2[0-3])\s*uur\b/i, // 20 uur
  /\b(?:om|rond)\s+([01]?\d|2[0-3])\b/i, // "om 11", "rond 9" — geen minuten, dus later dan de exactere patronen hierboven
  // Kale 4 cijfers als "1100" (Xander, 2 aug 2026: "Morgen ochtend 1100
  // padellen Rijswijk" werd niet herkend). Bewust beperkt tot uur 00-19 om
  // een jaartal als "2026" niet als "20:26" te lezen — avonduren na 20:00
  // worden al door de "20u"/"20 uur"/"20:00"-patronen hierboven afgevangen.
  /\b([01]\d)([0-5]\d)\b/,
];

/**
 * Eerste herkenbare tijdsaanduiding in vrije tekst, afgerond op het
 * dichtstbijzijnde half uur (zie rondAfOpHalfUur — geen boekingssysteem
 * biedt minuut-precisie). Null als er niets herkenbaars in staat.
 */
export function extraheerTijd(tekst: string): string | null {
  for (const patroon of TIJD_PATRONEN) {
    const m = patroon.exec(tekst);
    if (!m) continue;
    const uur = m[1].padStart(2, "0");
    const minuut = (m[2] ?? "00").padStart(2, "0");
    const kandidaat = `${uur}:${minuut}`;
    if (naarMinuten(kandidaat) !== null) return rondAfOpHalfUur(kandidaat);
  }
  return null;
}

/** "morgen"/"overmorgen"/"vandaag" in vrije tekst, of null (= geen expliciete dag genoemd). */
export function extraheerDag(tekst: string): number | null {
  const t = tekst.toLowerCase();
  if (/\bovermorgen\b/.test(t)) return 2;
  if (/\bmorgen\b/.test(t)) return 1;
  if (/\bvandaag\b/.test(t)) return 0;
  return null;
}

// Woorden die overblijven na het wegstrippen van dag/tijd uit een
// zoekopdracht, maar zelf geen plaatsnaam zijn. Bewust een losse lijst i.p.v.
// een taalmodel (Xander, 2 aug 2026: koos expliciet voor een gratis,
// snellere parser i.p.v. een Claude-API-aanroep per bericht).
const PLAATS_STOPWOORDEN = new Set([
  "zoek", "zoeken", "zoekt", "een", "de", "het", "baan", "banen", "padellen",
  "padelen", "padel", "rond", "om", "in", "bij", "voor", "ochtend", "middag",
  "avond", "vanavond", "alsjeblieft", "aub", "graag", "wil", "wilt", "ik",
  "je", "plek", "plekje", "plekjes", "vrije", "vrij", "spelen", "speel", "en",
]);

/**
 * Plaatsnaam uit vrije tekst. Twee stappen:
 * 1. Het strikte patroon "in/bij <plaats>" — meest betrouwbaar, dus eerst
 *    geprobeerd.
 * 2. Anders: dag, tijd en bekende vulwoorden wegstrippen en aannemen dat wat
 *    overblijft de plaatsnaam is. Nodig omdat lang niet iedereen "in/bij"
 *    typt (Xander, 2 aug 2026: "Morgen ochtend 1100 padellen Rijswijk" en
 *    "Padellen Rijswijk morgen 11:00" werden allebei niet herkend). Alleen
 *    toegepast als het bericht al een padel/tijd/dag-signaal bevat, anders
 *    zou elk willekeurig chatbericht als zoekopdracht gelezen worden.
 */
export function extraheerPlaats(tekst: string): string | null {
  const expliciet =
    /\b(?:in|bij)\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s'-]{1,40}?)(?=\s+(?:rond|om|vanavond|vandaag|morgen|overmorgen)\b|[.,!?]|\s+\d|$)/i.exec(
      tekst
    );
  if (expliciet) return expliciet[1].trim();

  const heeftSignaal = /padel|baan/i.test(tekst) || extraheerTijd(tekst) !== null || extraheerDag(tekst) !== null;
  if (!heeftSignaal) return null;

  let rest = tekst.replace(/\bovermorgen\b/gi, " ").replace(/\bmorgen\b/gi, " ").replace(/\bvandaag\b/gi, " ");
  for (const patroon of TIJD_PATRONEN) {
    rest = rest.replace(new RegExp(patroon.source, patroon.flags.includes("g") ? patroon.flags : `${patroon.flags}g`), " ");
  }
  rest = rest.replace(/[.,!?]/g, " ");

  const woorden = rest.split(/\s+/).filter((w) => w.length > 0 && !PLAATS_STOPWOORDEN.has(w.toLowerCase()));
  if (woorden.length === 0) return null;
  return woorden.join(" ").trim();
}

export type AdhocZoekopdracht = { plaatsQuery: string; tijd: string | null; dagOffset: number | null };

/** Herkent "zoek een baan in <plaats> [rond/om <tijd>] [morgen/overmorgen]"-achtige berichten. */
export function parseAdhocZoekopdracht(tekst: string): AdhocZoekopdracht | null {
  const plaatsQuery = extraheerPlaats(tekst);
  if (!plaatsQuery) return null;
  return { plaatsQuery, tijd: extraheerTijd(tekst), dagOffset: extraheerDag(tekst) };
}

// --- Locatie opzoeken ---------------------------------------------------

export async function zoekLocatieKandidaten(plaatsQuery: string): Promise<GevondenLocatie[]> {
  // Alleen dorpen/steden — geen straten, zie de toelichting bij zoekLocatiesPdok.
  return zoekLocatiesPdok(plaatsQuery, 5, ["woonplaats"]);
}

// --- Live beschikbaarheid ophalen + formatteren voor een chatbericht ---

/**
 * Haalt live beschikbaarheid op voor clubs binnen de straal en formatteert
 * een chatbericht. `siteUrl` moet het eigen deployment zijn (NEXT_PUBLIC_
 * SITE_URL) — de bot roept de bestaande /api/beschikbaarheid aan i.p.v. de
 * scrapers zelf te importeren, zodat er maar één plek is die weet hoe je
 * per boekingssysteem beschikbaarheid ophaalt.
 */
export async function zoekBeschikbaarheidVoorChat(
  coord: Coordinaat,
  plaatsnaam: string,
  tijd: string | null,
  siteUrl: string,
  dagOffsetUitTekst: number | null = null,
  // Optioneel: geeft de radarlink mee via de sessiebrug (src/lib/telegramSessie.ts)
  // zodat een klik vanuit Telegram direct ingelogd binnenkomt. Zonder deze
  // param (bv. in tests) blijft het een kale, uitgelogde link — zoeken werkt
  // sowieso zonder account.
  sessieBrug: { admin: SupabaseClient; profielId: string } | null = null
): Promise<string> {
  const inStraal = binnenStraal(CLUBS, coord, STRAAL_ADHOC_KM).slice(0, MAX_CLUBS_ADHOC);
  if (inStraal.length === 0) {
    return `Ik ken geen padelclubs binnen ${STRAAL_ADHOC_KM} km van ${plaatsnaam}.`;
  }

  const { datum, dagOffset } = kiesZoekdatum(dagOffsetUitTekst);
  const ids = inStraal.map((c) => c.id);
  const linkParams = new URLSearchParams({
    lat: String(coord.lat),
    lon: String(coord.lon),
    plaats: plaatsnaam,
    straal: String(STRAAL_ADHOC_KM),
    datum,
  });
  if (tijd) linkParams.set("tijd", tijd);
  // Bewust naar de eigen site, niet naar de boekingssystemen zelf — een
  // gebruiker die via de bot zoekt, boekt zo via VrijeBaan i.p.v. dat de
  // click meteen naar een externe site gaat.
  const radarPad = `/radar?${linkParams.toString()}`;
  let radarLink = `${siteUrl}${radarPad}`;
  if (sessieBrug) {
    try {
      const token = await maakInlogToken(sessieBrug.admin, sessieBrug.profielId);
      radarLink = bouwSessieLink(siteUrl, token, radarPad);
    } catch (err) {
      // Nooit de zoekopdracht laten mislukken omdat het inloggen-optimaliseren
      // faalt — de kale link werkt nog steeds, alleen niet automatisch ingelogd.
      console.error("[telegram] Inlogtoken voor radarlink maken mislukt, val terug op kale link:", err);
    }
  }

  let data: { beschikbaarheid: BeschikbaarheidRij[] };
  try {
    const res = await fetch(
      `${siteUrl}/api/beschikbaarheid?datum=${datum}&clubs=${encodeURIComponent(ids.join(","))}`
    );
    if (!res.ok) throw new Error(`beschikbaarheid gaf ${res.status}`);
    data = await res.json();
  } catch {
    return (
      `Live beschikbaarheid ophalen lukte nu niet. Bekijk het zelf op de Radar:\n\n${radarLink}`
    );
  }

  const perClub = new Map(data.beschikbaarheid.map((r) => [r.clubId, r]));
  const regels: string[] = [];
  for (const club of inStraal) {
    const rij = perClub.get(club.id);
    if (!rij || rij.fout || rij.sloten.length === 0) continue; // stil overslaan i.p.v. "geen plek" beweren bij een mislukte meting
    const passend = tijd ? rij.sloten.filter((s) => binnenTijdvenster(s.tijd, tijd, MARGE_UREN_ADHOC)) : rij.sloten;
    if (passend.length === 0) continue;
    const tijden = passend
      .slice(0, 4)
      .map((s) => (s.prijs ? `${s.tijd} (${s.prijs})` : s.tijd))
      .join(", ");
    regels.push(`• ${club.naam} — ${tijden}`);
    if (regels.length >= MAX_CLUBS_IN_BERICHT) break;
  }

  const dagTekst = dagLabel(datum, dagOffset).toLowerCase();
  const kop = tijd
    ? `Padel bij ${plaatsnaam} rond ${tijd}, ${dagTekst} (${datum}):`
    : `Padel bij ${plaatsnaam}, ${dagTekst} (${datum}):`;

  if (regels.length === 0) {
    return `${kop}\n\nGeen vrije tijden gevonden die passen. Bekijk alle clubs en dagen op de Radar:\n\n${radarLink}`;
  }
  return `${kop}\n\n${regels.join("\n")}\n\nBoek via de Radar:\n${radarLink}`;
}
