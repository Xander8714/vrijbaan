/**
 * Gesprekslogica voor de Telegram-bot (2 aug 2026, uitgebreid 5 aug 2026) —
 * los van het Telegram-protocol zelf (dat blijft in
 * src/app/api/telegram/webhook), zodat dit los te testen is. Drie
 * gespreksvormen:
 *
 * 1. Onboarding (na het koppelen): "waar wil je padellen?" + "hoe laat?" —
 *    zet profiles.lat/lon/woonplaats/zoekstraal_km/voorkeurstijd, gebruikt
 *    door de achtergrond-poller voor toekomstige meldingen.
 * 2. Losse zoekopdracht in vrije tekst ("zoek een baan in Haarlem rond
 *    20:00") — direct een live antwoord met tijden, geen opgeslagen state.
 * 3. Profiel aanpassen buiten onboarding om (5 aug 2026): straal, tijd en
 *    locatie via parseProfielWijzigingen, en vaste speelmomenten (dag+tijd,
 *    tabel vaste_speelmomenten) via parseVastMomentOpdracht. Bewust GEEN
 *    losse "favoriete dag"-kolom — dat zou een tweede, ongebruikt
 *    dagen-concept zijn naast de al bestaande vaste_speelmomenten-tabel
 *    (zie src/app/account/VasteMomenten.tsx), die dag én tijd samen opslaat
 *    plus een eigen "op de hoogte houden"-vinkje per moment.
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
import { binnenTijdvenster, dagLabel, MAX_DAGEN_VOORUIT_ZOEKEN, naarMinuten, rondAfOpHalfUur } from "./tijd";
import { bouwSessieLink, maakInlogToken } from "./telegramSessie";

const STRAAL_ADHOC_KM = 10;
// Zelfde soort grens als MAX_CLUBS in src/app/api/beschikbaarheid/route.ts,
// hier kleiner gehouden: een chatbericht met 20 clubs is niet leesbaar, en
// elke Playtomic/Meet & Play-club in de lijst kost een aparte Playwright-run.
const MAX_CLUBS_ADHOC = 12;
const MAX_CLUBS_IN_BERICHT = 6;
const MARGE_UREN_ADHOC = 2;

// Zelfde grens als de Radar-pagina's straal-slider (min=1, max=25) — de
// ruimste van de twee plekken die profiles.zoekstraal_km al bewerken (de
// Account-pagina's slider gaat maar tot 10). De databasecheck zelf staat
// 1-200 toe, maar de bot moet niet ruimer zijn dan wat een gebruiker via de
// site sowieso al kan instellen.
const MIN_STRAAL_KM = 1;
const MAX_STRAAL_KM = 25;

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

// Nederlandse maandnamen voor expliciete kalenderdatums ("19 augustus") in
// vrije tekst (5 aug 2026, Xander: "zoek 19 augustus een baan in haarlem om
// 2030 - dat snapt de bot nu ook nog niet"). Reikt tot MAX_DAGEN_VOORUIT_ZOEKEN
// dagen vooruit — zelfde grens als de Radar-deep-link-acceptatie (zie
// src/lib/tijd.ts en radar/page.tsx), zodat de website en de bot nooit een
// ander antwoord geven op "hoe ver vooruit mag ik zoeken". Geen afkortingen
// ("19 aug") — bewust beperkt tot volledige maandnamen, dat dekt het gevraagde
// geval en voorkomt een regex die per ongeluk iets anders opvangt.
const MAANDNAMEN: Record<string, number> = {
  januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5,
  juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11,
};
export const KALENDERDATUM_RE =
  /\b(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\b/i;

/**
 * "19 augustus" → aantal dagen vanaf vandaag. Een datum die dit jaar al
 * voorbij is wordt als volgend jaar gelezen (padel-zoekopdrachten gaan nooit
 * meer dan een jaar vooruit, dus geen ambiguïteit). Ligt de datum verder dan
 * MAX_DAGEN_VOORUIT_ZOEKEN: expliciet `teVer: true` teruggeven i.p.v.
 * stilzwijgend null — anders zou de aanroeper terugvallen op "vandaag" zonder
 * dat te melden, precies de verwarring die Xander op de Radar tegenkwam met
 * een deep link die zomaar een andere dag opleverde dan de link beloofde.
 */
export function extraheerKalenderdatum(
  tekst: string,
  nu: Date = new Date()
): { offset: number; teVer: false } | { offset: null; teVer: true } | null {
  const m = KALENDERDATUM_RE.exec(tekst);
  if (!m) return null;
  const dag = Number(m[1]);
  const maand = MAANDNAMEN[m[2].toLowerCase()];
  if (dag < 1 || dag > 31) return null;

  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  let kandidaat = new Date(nu.getFullYear(), maand, dag);
  if (kandidaat < vandaag) kandidaat = new Date(nu.getFullYear() + 1, maand, dag);

  const offset = Math.round((kandidaat.getTime() - vandaag.getTime()) / 86_400_000);
  return offset > MAX_DAGEN_VOORUIT_ZOEKEN ? { offset: null, teVer: true } : { offset, teVer: false };
}

/** "morgen"/"overmorgen"/"vandaag"/een expliciete kalenderdatum in vrije tekst, of null (= geen dag genoemd of te ver vooruit). */
export function extraheerDag(tekst: string): number | null {
  const t = tekst.toLowerCase();
  if (/\bovermorgen\b/.test(t)) return 2;
  if (/\bmorgen\b/.test(t)) return 1;
  if (/\bvandaag\b/.test(t)) return 0;
  const kalender = extraheerKalenderdatum(tekst);
  return kalender?.teVer ? null : (kalender?.offset ?? null);
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

  // extraheerKalenderdatum() apart van extraheerDag() gecheckt: een tè-ver-
  // vooruit-datum geeft bij extraheerDag() null terug (zie daar), maar moet
  // hier nog wél als signaal tellen — anders bereikt "zoek 19 augustus
  // Haarlem" (geen ander padel/tijd-woord) parseAdhocZoekopdracht() nooit,
  // en verschijnt de "te ver vooruit"-foutmelding daar dus nooit.
  const heeftSignaal =
    /padel|baan/i.test(tekst) ||
    extraheerTijd(tekst) !== null ||
    extraheerDag(tekst) !== null ||
    extraheerKalenderdatum(tekst) !== null;
  if (!heeftSignaal) return null;

  let rest = tekst.replace(/\bovermorgen\b/gi, " ").replace(/\bmorgen\b/gi, " ").replace(/\bvandaag\b/gi, " ");
  rest = rest.replace(KALENDERDATUM_RE, " ");
  for (const patroon of TIJD_PATRONEN) {
    rest = rest.replace(new RegExp(patroon.source, patroon.flags.includes("g") ? patroon.flags : `${patroon.flags}g`), " ");
  }
  rest = rest.replace(/[.,!?]/g, " ");

  const woorden = rest.split(/\s+/).filter((w) => w.length > 0 && !PLAATS_STOPWOORDEN.has(w.toLowerCase()));
  if (woorden.length === 0) return null;
  return woorden.join(" ").trim();
}

export type AdhocZoekopdracht = { plaatsQuery: string; tijd: string | null; dagOffset: number | null; fout?: string };

/**
 * Herkent "zoek een baan in <plaats> [rond/om <tijd>] [morgen/overmorgen/19
 * augustus]"-achtige berichten. Bij een kalenderdatum verder dan
 * MAX_DAGEN_VOORUIT_ZOEKEN: `fout` gezet i.p.v. stilzwijgend een andere dag
 * kiezen — de aanroeper (webhook-route) moet die dan tonen en de
 * zoekopdracht NIET alsnog uitvoeren, zie de toelichting bij
 * extraheerKalenderdatum hierboven.
 */
export function parseAdhocZoekopdracht(tekst: string, nu: Date = new Date()): AdhocZoekopdracht | null {
  const plaatsQuery = extraheerPlaats(tekst);
  if (!plaatsQuery) return null;

  const kalender = extraheerKalenderdatum(tekst, nu);
  if (kalender?.teVer) {
    return {
      plaatsQuery,
      tijd: extraheerTijd(tekst),
      dagOffset: null,
      fout: `Ik kan maximaal ${MAX_DAGEN_VOORUIT_ZOEKEN} dagen vooruit zoeken. Kies een datum binnen die periode.`,
    };
  }
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
  // Padellen speel je met z'n vieren — Xander (3 aug 2026): een gevonden
  // plek doorsturen is de goedkoopste manier om iemand nieuw op VrijeBaan
  // te krijgen. Telegram's eigen "doorsturen" doet de rest, dit is puur de
  // nudge om eraan te denken.
  return `${kop}\n\n${regels.join("\n")}\n\nBoek via de Radar:\n${radarLink}\n\nStuur dit door naar je padelmaatjes.`;
}

// --- Profiel aanpassen via vrije tekst (5 aug 2026) ---------------------
//
// Alles hieronder is nieuw t.o.v. de losse zoekopdracht hierboven: geen
// éénmalige zoekvraag, maar een instelling die blijft staan tot de
// gebruiker hem weer wijzigt. Xander na het eerste gebruik van de bot:
// "ik kon er niet goed tegen praten" — dit maakt straal/tijd/locatie en
// vaste speelmomenten net zo natuurlijk aanpasbaar als een zoekopdracht,
// zonder terug te hoeven naar de Account-pagina.

function normaliseerTekst(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Leest tijden uit normale Nederlandse tekst, ruimer dan extraheerTijd
 * hierboven (die blijft ongewijzigd voor de losse zoekopdracht, om die
 * bestaande, al werkende plaats-extractie niet te verstoren — zie
 * extraheerPlaats die op TIJD_PATRONEN steunt om de plaatsnaam over te
 * houden).
 *
 * Ondersteunt: 20:00, 20.00, 20u00, 20u, 2000, 830, 8, 20, "om 20", "rond
 * 1930" en, buiten context "profiel", ook een tijd zonder "om"/"tijd"
 * ervoor: een kaal antwoord in context "tijdantwoord" (bv. tijdens de
 * onboardingvraag "hoe laat?") en een los getal ergens in de zin in context
 * "vastmoment" (bv. "zet dinsdag 20:00 als vast moment" — daar staat de tijd
 * los naast de dag, zonder "om" ervoor). Context "profiel" blijft wél
 * strikter, juist om "straal 20 km" niet als 20:00 te lezen.
 */
export function extraheerFlexibeleTijd(
  tekst: string,
  context: "tijdantwoord" | "profiel" | "zoeken" | "vastmoment" = "profiel"
): string | null {
  const schoon = normaliseerTekst(tekst);

  if (/(geen voorkeur|geen vaste tijd|tijd verwijderen|wis.*tijd|zonder tijd)/.test(schoon)) {
    return null;
  }

  const contextMatches = [
    ...schoon.matchAll(
      /(?:om|rond|tegen|vanaf|tijd(?:stip)?(?:\s+op|\s+naar|\s+is)?|meestal)\s+(\d{1,2})(?:(?::|\.|u)\s?(\d{2}))?\b/g
    ),
  ];
  const compactContextMatches = [
    ...schoon.matchAll(
      /(?:om|rond|tegen|vanaf|tijd(?:stip)?(?:\s+op|\s+naar|\s+is)?|meestal)\s+(\d{3,4})\b/g
    ),
  ];

  let uren: number | null = null;
  let minuten = 0;

  const compact = compactContextMatches.at(-1)?.[1];
  if (compact) {
    if (compact.length === 3) {
      uren = Number(compact.slice(0, 1));
      minuten = Number(compact.slice(1));
    } else {
      uren = Number(compact.slice(0, 2));
      minuten = Number(compact.slice(2));
    }
  } else {
    const match = contextMatches.at(-1);
    if (match) {
      uren = Number(match[1]);
      minuten = match[2] ? Number(match[2]) : 0;
    }
  }

  if (uren === null && context === "tijdantwoord") {
    // Hele bericht is niets anders dan het antwoord — vandaar ^...$.
    const alleenCompact = schoon.match(/^(\d{3,4})$/);
    const alleenGescheiden = schoon.match(/^(\d{1,2})(?::|\.|u)(\d{2})$/);
    const alleenUur = schoon.match(/^(\d{1,2})(?:\s*uur)?$/);

    if (alleenCompact) {
      const waarde = alleenCompact[1];
      uren = waarde.length === 3 ? Number(waarde.slice(0, 1)) : Number(waarde.slice(0, 2));
      minuten = waarde.length === 3 ? Number(waarde.slice(1)) : Number(waarde.slice(2));
    } else if (alleenGescheiden) {
      uren = Number(alleenGescheiden[1]);
      minuten = Number(alleenGescheiden[2]);
    } else if (alleenUur) {
      uren = Number(alleenUur[1]);
      minuten = 0;
    }
  }

  if (uren === null && context === "vastmoment") {
    // Hier NIET ^...$: "zet dinsdag 20:00 als vast moment" heeft nog woorden
    // omheen, de tijd hoeft alleen ergens los (zonder "om"/"tijd" ervoor) in
    // de zin te staan — de dag+vast-moment-context is dan al genoeg signaal.
    const compactOveral = schoon.match(/\b(\d{3,4})\b/);
    const gescheidenOveral = schoon.match(/\b(\d{1,2})(?::|\.|u)(\d{2})\b/);
    const uurOveral = schoon.match(/\b(\d{1,2})\s*uur\b/);

    if (compactOveral) {
      const waarde = compactOveral[1];
      uren = waarde.length === 3 ? Number(waarde.slice(0, 1)) : Number(waarde.slice(0, 2));
      minuten = waarde.length === 3 ? Number(waarde.slice(1)) : Number(waarde.slice(2));
    } else if (gescheidenOveral) {
      uren = Number(gescheidenOveral[1]);
      minuten = Number(gescheidenOveral[2]);
    } else if (uurOveral) {
      uren = Number(uurOveral[1]);
      minuten = 0;
    }
  }

  if (
    uren === null ||
    !Number.isInteger(uren) ||
    !Number.isInteger(minuten) ||
    uren < 0 ||
    uren > 23 ||
    minuten < 0 ||
    minuten > 59
  ) {
    return null;
  }

  // rondAfOpHalfUur (tijd.ts) rondt sowieso af — hier alvast een geldig
  // "HH:MM"-formaat van maken zodat die functie er iets mee kan.
  return rondAfOpHalfUur(`${String(uren).padStart(2, "0")}:${String(minuten).padStart(2, "0")}`);
}

/** "maak mijn straal 5 km" / "zoekstraal op 8" e.d. null als er geen straal-signaal in staat. */
export function extraheerStraal(tekst: string): number | null {
  const schoon = normaliseerTekst(tekst);
  const match = schoon.match(
    /(?:zoekstraal|straal|zoekafstand|radius|binnen)\s*(?:op|naar|van|is)?\s*(\d{1,3})(?:\s*(?:km|kilometer))?\b/
  );
  if (!match) return null;
  return Number(match[1]);
}

/** "verander mijn locatie naar Leiden" / "ik woon nu in Leiden" e.d. */
export function extraheerLocatieWijziging(tekst: string): string | null {
  const schoon = normaliseerTekst(tekst);
  const locatieMatch = schoon.match(
    /(?:verander|wijzig|zet|maak|gebruik)\s+(?:mijn\s+)?(?:locatie|woonplaats|zoeklocatie)\s+(?:naar|op)?\s+(.+)$/
  );
  const woonNuMatch = schoon.match(/\bik woon nu in\s+(.+)$/);
  const query = locatieMatch?.[1] ?? woonNuMatch?.[1];
  if (!query || query.length < 2) return null;
  return query.trim();
}

/**
 * Blokkeert gevoelige accountacties altijd, ongeacht wat de overige parsers
 * erin herkennen — telefoonnummer wijzigen en account verwijderen kunnen
 * bewust NIET via Telegram (zie ook src/app/api/telegram/webhook/route.ts),
 * en een paar voor de hand liggende escalatiepogingen (rol/rechten/SQL)
 * worden voor de zekerheid ook afgevangen, ook al bestaat er geen pad dat
 * die daadwerkelijk zou uitvoeren.
 */
export function bevatVerbodenActie(tekst: string): boolean {
  const schoon = normaliseerTekst(tekst);
  return [
    /\b(telefoonnummer|mobiele nummer|06 nummer)\b.*\b(wijzig|verander|aanpas|zet)\b/,
    /\b(wijzig|verander|aanpas|zet)\b.*\b(telefoonnummer|mobiele nummer|06 nummer)\b/,
    /\b(account|profiel)\b.*\b(verwijder|delete|opheffen|opzeggen)\b/,
    /\b(verwijder|delete|opheffen|opzeggen)\b.*\b(account|profiel)\b/,
    /\b(maak|geef|zet)\b.*\b(admin|beheerder|administrator)\b/,
    /\b(wijzig|verander)\b.*\b(rol|rechten|wachtwoord|email|e-mail)\b/,
    /\b(sql|database query|drop table|delete from|update profiles)\b/,
  ].some((patroon) => patroon.test(schoon));
}

export type ProfielWijzigingen = {
  straalKm?: number;
  voorkeurstijd?: string | null;
  locatieQuery?: string;
};

export type ParseResultaat = {
  wijzigingen: ProfielWijzigingen;
  herkend: boolean;
  fout?: string;
};

/**
 * Herkent straal/tijd/locatie-wijzigingen door elkaar in één bericht (zodat
 * "maak straal 5 km en zet mijn tijd op 2000" in één keer verwerkt wordt).
 * "Favoriete dagen" loopt bewust via een apart pad (parseVastMomentOpdracht
 * hieronder) — die schrijft naar vaste_speelmomenten, een tabel, niet naar
 * een los profielveld, dus die past niet in dit ene update-object.
 */
export function parseProfielWijzigingen(tekst: string): ParseResultaat {
  const schoon = normaliseerTekst(tekst);
  const wijzigingen: ProfielWijzigingen = {};
  let herkend = false;

  const straal = extraheerStraal(tekst);
  if (straal !== null) {
    herkend = true;
    if (straal < MIN_STRAAL_KM || straal > MAX_STRAAL_KM) {
      return {
        wijzigingen,
        herkend,
        fout: `Je zoekstraal moet tussen ${MIN_STRAAL_KM} en ${MAX_STRAAL_KM} km liggen.`,
      };
    }
    wijzigingen.straalKm = straal;
  }

  const verwijderTijd = /\b(geen voorkeur|geen vaste tijd|tijd verwijderen|wis.*tijd|zonder tijd)\b/.test(schoon);
  // Bewust NIET op kale "om"/"rond" alleen — dat zijn ook precies de woorden
  // waarmee de losse zoekopdracht een tijd aangeeft ("zoek een baan in
  // Haarlem rond 20:00"). Zonder deze beperking zou zo'n zoekopdracht de
  // persoonlijke voorkeurstijd stilzwijgend overschrijven i.p.v. gewoon een
  // eenmalige zoekvraag te zijn. Het woord "tijd" zelf (of "voorkeurstijd",
  // of een expliciet werkwoord+tijd) komt in een losse zoekopdracht vrijwel
  // nooit voor, dus dat blijft wél een betrouwbaar signaal.
  const heeftTijdContext =
    verwijderTijd ||
    /voorkeurstijd|\btijdstip\b|\bmijn tijd\b|\bje tijd\b|\btijd\s+(?:op|naar|is)\b|\b(?:zet|verander|wijzig|maak|stel|pas)\b.*\btijd\b/.test(
      schoon
    );

  if (heeftTijdContext) {
    const tijd = extraheerFlexibeleTijd(tekst, "profiel");
    if (verwijderTijd) {
      herkend = true;
      wijzigingen.voorkeurstijd = null;
    } else if (tijd) {
      herkend = true;
      wijzigingen.voorkeurstijd = tijd;
    } else {
      return {
        wijzigingen,
        herkend: true,
        fout: 'Ik herken de tijd niet. Gebruik bijvoorbeeld "2000", "20:00", "830" of "8".',
      };
    }
  }

  const locatieQuery = extraheerLocatieWijziging(tekst);
  if (locatieQuery) {
    herkend = true;
    wijzigingen.locatieQuery = locatieQuery;
  }

  return { wijzigingen, herkend };
}

// --- Vaste speelmomenten via chat (5 aug 2026) --------------------------
//
// "Favoriete dagen" uit het oorspronkelijke idee gekoppeld aan de bestaande
// tabel vaste_speelmomenten (dag+tijd samen, zie de migratie van 3 aug 2026
// en src/app/account/VasteMomenten.tsx) i.p.v. een nieuwe, losse
// dagen-kolom: die tabel is al de plek die de wekelijkse herinnering
// (scripts/poll-availability.ts) leest, dus een tweede "dagen"-concept ernaast
// zou nergens door gelezen worden.

// JS Date#getDay()-conventie (0=zondag) — zelfde als vaste_speelmomenten.dag
// en src/app/account/VasteMomenten.tsx.
const WEEKDAG_NAAR_NUMMER: Record<string, number> = {
  zondag: 0, maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6,
  zo: 0, ma: 1, di: 2, wo: 3, do: 4, vr: 5, za: 6,
};
// Weergavevolgorde begint bij maandag, zelfde reden als VasteMomenten.tsx:
// leest natuurlijker in het Nederlands, ook al is 0 (zondag) de opgeslagen waarde.
const WEEKDAG_VOLGORDE = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAGNAMEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

function sorteerDagen(dagen: number[]): number[] {
  const uniek = [...new Set(dagen)];
  return WEEKDAG_VOLGORDE.filter((d) => uniek.includes(d));
}

/** Weekdagnamen/-afkortingen uit vrije tekst, plus "elke dag"/"werkdagen"/"weekend". Geen dagwoorden = lege lijst. */
export function extraheerWeekdagen(tekst: string): number[] {
  const schoon = normaliseerTekst(tekst);
  const resultaat: number[] = [];

  if (/\b(elke dag|alle dagen|dagelijks)\b/.test(schoon)) return sorteerDagen([0, 1, 2, 3, 4, 5, 6]);
  if (/\b(werkdagen|doordeweeks)\b/.test(schoon)) resultaat.push(1, 2, 3, 4, 5);
  if (/\b(weekend|weekenden)\b/.test(schoon)) resultaat.push(6, 0);

  for (const [naam, nummer] of Object.entries(WEEKDAG_NAAR_NUMMER)) {
    if (new RegExp(`\\b${naam}\\b`).test(schoon)) resultaat.push(nummer);
  }

  return sorteerDagen(resultaat);
}

/** "dinsdag 20:00" — voor bevestigings- en statusberichten. */
export function formatteerVastMoment(dag: number, tijd: string): string {
  return `${WEEKDAGNAMEN[dag]} ${tijd}`;
}

export type VastMomentActie = "toevoegen" | "verwijderen";
export type VastMomentOpdracht = { actie: VastMomentActie; dagen: number[]; tijd: string | null };

// Alleen bij een van deze signalen gaat een bericht als vast-moment-opdracht
// door — anders zou elk toevallig genoemd weekdagwoord (die ook in een losse
// zoekopdracht kan voorkomen) al als "vast moment instellen" gelezen worden.
const VAST_MOMENT_CONTEXT =
  /\b(vast moment|vaste moment|vaste speelmoment|vaste speeldag|structureel|elke week|wekelijks|speeldag|speeldagen|favoriete dag|favoriete dagen)\b/;

// Los van VAST_MOMENT_CONTEXT hierboven ook een simpel werkwoordsignaal:
// "haal dinsdag weg" of "zet dinsdag 20:00" zijn allebei natuurlijke,
// ondubbelzinnige opdrachten zonder dat de gebruiker per se het woord "vast
// moment" hoeft te typen. Ad-hoc zoekopdrachten ("zoek een baan in...")
// gebruiken geen van deze werkwoorden, dus het risico op verwarring is laag.
const VAST_MOMENT_VERWIJDER_SIGNAAL = /\b(haal|verwijder|niet meer|stop met)\b/;
const VAST_MOMENT_TOEVOEG_SIGNAAL = /\b(voeg|toevoegen|erbij|zet|maak|stel)\b/;

/**
 * Herkent "zet/voeg dinsdag 20:00 toe als vast moment" en "haal
 * dinsdag/dinsdag 20:00 weg" (met eventueel meerdere dagen in één bericht).
 * Null als er geen weekdag + duidelijk vast-moment-signaal in staat.
 */
export function parseVastMomentOpdracht(tekst: string): VastMomentOpdracht | null {
  const schoon = normaliseerTekst(tekst);
  const dagen = extraheerWeekdagen(tekst);
  if (dagen.length === 0) return null;

  const verwijderen = VAST_MOMENT_VERWIJDER_SIGNAAL.test(schoon) || /\bweg\b/.test(schoon);
  const toevoegen = VAST_MOMENT_TOEVOEG_SIGNAAL.test(schoon);

  if (!VAST_MOMENT_CONTEXT.test(schoon) && !verwijderen && !toevoegen) return null;

  const tijd = extraheerFlexibeleTijd(tekst, "vastmoment");

  return { actie: verwijderen ? "verwijderen" : "toevoegen", dagen, tijd };
}

type VastSpeelmomentRij = { id: string; dag: number; tijd: string };

/**
 * Voert een parseVastMomentOpdracht-resultaat door tegen vaste_speelmomenten
 * en geeft het bevestigings- of foutbericht terug. Slaat bewust dubbele
 * momenten (zelfde dag+tijd, al bestaand) over i.p.v. ze nogmaals in te
 * voegen — anders levert twee keer dezelfde opdracht sturen twee identieke
 * rijen op.
 */
export async function pasVasteMomentToe(
  admin: SupabaseClient,
  profielId: string,
  opdracht: VastMomentOpdracht
): Promise<string> {
  if (opdracht.actie === "toevoegen" && !opdracht.tijd) {
    return "Welke tijd hoort daarbij? Bijvoorbeeld \"zet dinsdag 20:00 als vast moment\".";
  }

  const { data: bestaand, error: leesFout } = await admin
    .from("vaste_speelmomenten")
    .select("id, dag, tijd")
    .eq("profile_id", profielId);

  if (leesFout) {
    console.error("[telegram] Vaste speelmomenten lezen mislukt:", leesFout.message);
    return "Dat kon ik nu niet opslaan. Probeer het later opnieuw.";
  }

  const rijen = (bestaand ?? []) as VastSpeelmomentRij[];

  if (opdracht.actie === "verwijderen") {
    const teVerwijderen = rijen.filter(
      (r) => opdracht.dagen.includes(r.dag) && (opdracht.tijd === null || r.tijd === opdracht.tijd)
    );
    if (teVerwijderen.length === 0) {
      return "Ik vond geen vast moment dat daarbij past — check /status voor je huidige momenten.";
    }
    const { error } = await admin
      .from("vaste_speelmomenten")
      .delete()
      .in("id", teVerwijderen.map((r) => r.id));
    if (error) {
      console.error("[telegram] Vast speelmoment verwijderen mislukt:", error.message);
      return "Verwijderen lukte niet. Probeer het later opnieuw.";
    }
    const omschrijving = teVerwijderen.map((r) => formatteerVastMoment(r.dag, r.tijd)).join(", ");
    return `Verwijderd: ${omschrijving}.`;
  }

  const tijd = opdracht.tijd!;
  const nieuw = opdracht.dagen.filter((dag) => !rijen.some((r) => r.dag === dag && r.tijd === tijd));

  if (nieuw.length === 0) {
    const omschrijving = opdracht.dagen.map((dag) => formatteerVastMoment(dag, tijd)).join(", ");
    return `Had je al staan: ${omschrijving}.`;
  }

  const { error } = await admin
    .from("vaste_speelmomenten")
    .insert(nieuw.map((dag) => ({ profile_id: profielId, dag, tijd, gemeld: true })));

  if (error) {
    console.error("[telegram] Vast speelmoment toevoegen mislukt:", error.message);
    const tabelOntbreekt = /relation|column|schema cache/i.test(error.message);
    return tabelOntbreekt
      ? "De database mist de tabel vaste_speelmomenten nog, of de migratie van 3 aug 2026 is niet uitgevoerd."
      : "Dat kon ik niet opslaan. Probeer het later opnieuw.";
  }

  const omschrijving = nieuw.map((dag) => formatteerVastMoment(dag, tijd)).join(", ");
  const overigeAlBestaand = opdracht.dagen.length - nieuw.length;
  const staartje = overigeAlBestaand > 0 ? ` (${overigeAlBestaand === 1 ? "1 dag had je al" : `${overigeAlBestaand} dagen had je al`})` : "";
  return `Toegevoegd als vast moment: ${omschrijving}${staartje}. Je krijgt hier een berichtje als dat moment volgende week ook vrij is.`;
}
