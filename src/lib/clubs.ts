import { Club } from "./types";
import { FOYS_CLUBS } from "./clubs.foys";
import { PLAYTOMIC_CLUBS } from "./clubs.playtomic";
import { MEETANDPLAY_CLUBS } from "./clubs.meetandplay";

// Startregio: Haarlem + 5 km (Velserbroek, Driehuis/Santpoort-Noord)
// Playtomic tenant_id's zijn geverifieerd via de publieke club-URL (staat
// letterlijk in de URL-slug, geen devtools nodig). Overhout en Peakz zijn
// op 23 juli 2026 geverifieerd via live Chrome-inspectie (zie API_REQUIREMENTS.md):
// Overhout draait op "Baanreserveren" (BR) achter een inlogmuur, Peakz op
// het "Foys" boekingsplatform met een publiek GET-endpoint.
//
// COÖRDINATEN (29 juli 2026): opgehaald via de PDOK Locatieserver
// (api.pdok.nl, geverifieerd live — zie src/lib/geo.ts). Alle acht staan nu
// op het middelpunt van hun wóónplaats, niet op hun eigen adres:
//   Haarlem          POINT(4.64668526 52.38242027)
//   Velserbroek      POINT(4.6633646  52.43342646)
//   Santpoort-Noord  POINT(4.6235641  52.43606623)
// Dat is bewust en expliciet gemarkeerd met coordinaatBron: "woonplaats".
// Gevolg: de zes Haarlemse clubs liggen op exact hetzelfde punt, dus de
// straal-filter werkt (die kijkt op stadsniveau) maar onderling sorteren op
// afstand binnen Haarlem zegt nog niets. Alleen WePadel heeft een bevestigd
// adres (van hun eigen Playtomic-clubpagina, 29 juli 2026); de rest moet nog
// opgezocht worden voordat coordinaatBron op "adres" kan.
const HANDMATIGE_CLUBS: Club[] = [
  // VERBORGEN in de app (boekbaarZonderLidmaatschap: false) — /reservations
  // redirect naar een inlogscherm, dus zelfs beschikbaarheid is niet publiek.
  { id: "overhout", naam: "Racketclub Overhout", plaats: "Haarlem", banen: 5, systeem: "Baanreserveren", status: "Bevestigd — overhout.baanreserveren.nl, LET OP: /reservations vereist inloggen (geen publieke beschikbaarheid-view)", boekingsUrl: "https://overhout.baanreserveren.nl/reservations", websiteUrl: "https://www.rcoverhout.nl", lat: 52.38242027, lon: 4.64668526, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: false },
  // NIET MEER VERBORGEN (29 juli 2026) — de "ledenstop senioren" bleek alleen
  // over échte clublidmaatschap te gaan: geverifieerd via Playwright dat een
  // niet-lid een baan in het winkelmandje kan leggen en alleen een gratis
  // KNLTB ID nodig heeft om af te rekenen, exact zoals bij Hofgeest/Schoten/
  // Groeneveen. Meet & Play blijkt dus KNLTB-ID-gebaseerd, niet
  // club-lidmaatschap-gebaseerd — de wachtlijst gaat over iets anders
  // (stemrecht/vereniging), niet over baanhuur.
  { id: "pim-mulier", naam: "TPV Pim Mulier", plaats: "Haarlem", banen: 4, systeem: "Meet & Play", status: "Boekbaar zonder lidmaatschap (KNLTB ID) — 'ledenstop senioren' geldt alleen voor clublidmaatschap, niet voor baanhuur", boekingsUrl: "https://meetandplay.nl/club/29462", lat: 52.38242027, lon: 4.64668526, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: true },
  { id: "wepadel", naam: "WePadel Haarlem", plaats: "Haarlem", banen: 8, systeem: "Playtomic", status: "Grootste outdoor club van NL — tenant_id dd28050e-35c4-4bd0-ab58-b2f88111846d", boekingsUrl: "https://playtomic.com/clubs/wepadel-haarlem", adres: "Reinaldapark 10, 2033 SX Haarlem", lat: 52.38242027, lon: 4.64668526, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: true },
  // De oude handmatige "peakz"-regel is op 29 juli 2026 verwijderd: Peakz
  // Haarlem komt nu uit clubs.foys.ts (gegenereerd uit de Foys-API), mét het
  // juiste locationId en exacte coördinaten. Het id dat hier eerder stond
  // (527bd7b9-…) bleek Amersfoort te zijn, niet Haarlem.
  { id: "padel25", naam: "PADEL25 Haarlem", plaats: "Haarlem", banen: 4, systeem: "Playtomic", status: "Actief — tenant_id 68640cb4-c026-4bb1-8184-6e2cfe0f5ccf", boekingsUrl: "https://playtomic.com/clubs/indoor-padel25-haarlem", lat: 52.38242027, lon: 4.64668526, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: true },
  // Alle vier Meet & Play-clubs hieronder zijn 29 juli 2026 individueel
  // geverifieerd (Playwright, headless): boekbaar zonder lidmaatschap, wel een
  // gratis KNLTB ID nodig. Club-id's gevonden via de landelijke directory
  // (meetandplay.nl/club, sportfilter Padel) — LET OP: dat is een ander id dan
  // het `data-id`-attribuut op de directory-kaart, zie
  // scripts/discover-meetandplay-clubs.ts.
  { id: "schoten", naam: "Schoten Tennis & Padel", plaats: "Haarlem", banen: 4, systeem: "Meet & Play", status: "Bevestigd boekbaar zonder lidmaatschap — wel een gratis KNLTB ID nodig", boekingsUrl: "https://meetandplay.nl/club/88181", lat: 52.38242027, lon: 4.64668526, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: true },
  { id: "hofgeest", naam: "LTC Hofgeest", plaats: "Velserbroek", banen: 3, systeem: "Meet & Play", status: "Bevestigd boekbaar zonder lidmaatschap — wel een gratis KNLTB ID nodig (alleen e-mailadres, geen lidmaatschap)", boekingsUrl: "https://meetandplay.nl/club/29942", lat: 52.43342646, lon: 4.6633646, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: true },
  { id: "groeneveen", naam: "LTC Groeneveen", plaats: "Santpoort-Noord (Driehuis)", banen: 10, systeem: "Meet & Play", status: "Bevestigd boekbaar zonder lidmaatschap — wel een gratis KNLTB ID nodig", boekingsUrl: "https://meetandplay.nl/club/29850", lat: 52.43606623, lon: 4.6235641, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: true },
];

// De landelijke lijst: handmatig onderzochte clubs rond Haarlem + alle
// Peakz-vestigingen uit de Foys-API + alle Playtomic-clubs + alle Meet &
// Play-padelclubs (elk landelijk, elk automatisch gegenereerd). Hiermee is de
// app niet meer regio-gebonden: iemand in Groningen of Sittard vindt nu ook
// clubs binnen zijn straal.
// Ontdekte clubs die we al handmatig kennen niet dubbel opnemen: die staan
// met hun eigen, beter gedocumenteerde regel in HANDMATIGE_CLUBS.
const HANDMATIGE_SLUGS = new Set(["wepadel-haarlem", "indoor-padel25-haarlem"]);
const HANDMATIGE_MEETANDPLAY_IDS = new Set(["29942", "88181", "29850", "29462"]); // hofgeest, schoten, groeneveen, pim-mulier

const ALLE_CLUBS: Club[] = [
  ...HANDMATIGE_CLUBS,
  ...FOYS_CLUBS,
  ...PLAYTOMIC_CLUBS.filter((club) => !HANDMATIGE_SLUGS.has(club.playtomicSlug)),
  ...MEETANDPLAY_CLUBS.filter((club) => !HANDMATIGE_MEETANDPLAY_IDS.has(club.meetAndPlayClubId)),
];

/**
 * Standaard zichtbaar: clubs waar iedereen kan boeken. Een vrije baan die je
 * niet kunt reserveren is geen vondst maar frustratie.
 * `null` (nog niet geverifieerd) blijft staan mét waarschuwing in de UI —
 * anders zou "onbekend" stilzwijgend als "vrij boekbaar" doorgaan.
 */
export const CLUBS: Club[] = ALLE_CLUBS.filter((club) => club.boekbaarZonderLidmaatschap !== false);

/**
 * Clubs waar boeken alleen kan met lidmaatschap of inlog. Niet weggegooid maar
 * apart: ben je er lid, dan kun je die vrije banen juist wél gebruiken. De
 * Radar laat je per club aanvinken "ik ben hier lid" en voegt 'm dan toe aan je
 * lijst, met "Boek hier" naar de clubsite in plaats van naar het (afgeschermde)
 * boekingssysteem.
 */
export const LEDEN_CLUBS: Club[] = ALLE_CLUBS.filter((club) => club.boekbaarZonderLidmaatschap === false);

/** Alles bij elkaar — voor documentatie/diagnose. */
export const CLUBS_INCLUSIEF_LEDENCLUBS: Club[] = ALLE_CLUBS;
