import { Club } from "./types";
import { FOYS_CLUBS } from "./clubs.foys";
import { PLAYTOMIC_CLUBS } from "./clubs.playtomic";

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
  // VERBORGEN: vereniging met ledenstop voor senioren — je kunt hier niet eens
  // lid worden, laat staan als niet-lid een baan boeken.
  { id: "pim-mulier", naam: "TPV Pim Mulier", plaats: "Haarlem", banen: 4, systeem: "Meet & Play", status: "Ledenstop senioren — wachtlijst heropend", lat: 52.38242027, lon: 4.64668526, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: false },
  { id: "wepadel", naam: "WePadel Haarlem", plaats: "Haarlem", banen: 8, systeem: "Playtomic", status: "Grootste outdoor club van NL — tenant_id dd28050e-35c4-4bd0-ab58-b2f88111846d", boekingsUrl: "https://playtomic.com/clubs/wepadel-haarlem", adres: "Reinaldapark 10, 2033 SX Haarlem", lat: 52.38242027, lon: 4.64668526, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: true },
  // De oude handmatige "peakz"-regel is op 29 juli 2026 verwijderd: Peakz
  // Haarlem komt nu uit clubs.foys.ts (gegenereerd uit de Foys-API), mét het
  // juiste locationId en exacte coördinaten. Het id dat hier eerder stond
  // (527bd7b9-…) bleek Amersfoort te zijn, niet Haarlem.
  { id: "padel25", naam: "PADEL25 Haarlem", plaats: "Haarlem", banen: 4, systeem: "Playtomic", status: "Actief — tenant_id 68640cb4-c026-4bb1-8184-6e2cfe0f5ccf", boekingsUrl: "https://playtomic.com/clubs/indoor-padel25-haarlem", lat: 52.38242027, lon: 4.64668526, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: true },
  // De drie Meet & Play-verenigingen staan op `null`: hun beschikbaarheid is
  // publiek te zien (bij Hofgeest zelfs end-to-end gescraped), maar of een
  // niet-lid daadwerkelijk kan boeken is NIET geverifieerd. Zodra dat getest
  // is: `true` als het kan, `false` als lidmaatschap verplicht blijkt — dan
  // verdwijnen ze automatisch uit de app.
  { id: "schoten", naam: "Schoten Tennis & Padel", plaats: "Haarlem", banen: 4, systeem: "Meet & Play", status: "Actief", lat: 52.38242027, lon: 4.64668526, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: null },
  // boekbaarZonderLidmaatschap: true — geverifieerd 29 juli 2026 (Playwright,
  // headless): een niet-lid kan een slot in het winkelmandje leggen (prijs
  // €20-30 zichtbaar) zonder enige lidmaatschapscheck. "Afrekenen" stuurt naar
  // meetandplay.nl/inloggen, en dat is een KNLTB ID — een gratis, kosteloze
  // registratie op alleen een e-mailadres ("Voer e-mail in, druk dan op het
  // pijltje rechts"), GEEN Hofgeest-lidmaatschap. Dus: iedereen kan boeken,
  // mits ze een (gratis) KNLTB ID aanmaken. Niet aangenomen voor Schoten/
  // Groeneveen — clubs kunnen dit per vestiging anders instellen.
  { id: "hofgeest", naam: "LTC Hofgeest", plaats: "Velserbroek", banen: 3, systeem: "Meet & Play", status: "Bevestigd boekbaar zonder lidmaatschap — wel een gratis KNLTB ID nodig (alleen e-mailadres, geen lidmaatschap)", boekingsUrl: "https://meetandplay.nl/club/29942", lat: 52.43342646, lon: 4.6633646, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: true },
  { id: "groeneveen", naam: "LTC Groeneveen", plaats: "Santpoort-Noord (Driehuis)", banen: 10, systeem: "Meet & Play", status: "Actief", lat: 52.43606623, lon: 4.6235641, coordinaatBron: "woonplaats", boekbaarZonderLidmaatschap: null },
];
// schoten, groeneveen: Meet & Play-club-id nog niet bevestigd, dus (nog) geen boekingsUrl.

// De landelijke lijst: handmatig onderzochte clubs rond Haarlem + alle
// Peakz-vestigingen uit de Foys-API (26 stuks, heel Nederland). Hiermee is de
// app niet meer regio-gebonden: iemand in Groningen of Sittard vindt nu ook
// clubs binnen zijn straal.
// Ontdekte Playtomic-clubs die we al handmatig kennen niet dubbel opnemen:
// WePadel en PADEL25 staan met hun eigen, beter gedocumenteerde regel in
// HANDMATIGE_CLUBS (incl. tenant_id).
const HANDMATIGE_SLUGS = new Set(["wepadel-haarlem", "indoor-padel25-haarlem"]);

const ALLE_CLUBS: Club[] = [
  ...HANDMATIGE_CLUBS,
  ...FOYS_CLUBS,
  ...PLAYTOMIC_CLUBS.filter((club) => !HANDMATIGE_SLUGS.has(club.playtomicSlug)),
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
