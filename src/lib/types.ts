export type BoekingSysteem = "Playtomic" | "Meet & Play" | "Foys" | "Baanreserveren";

// coordinaatBron maakt zichtbaar hoe nauwkeurig lat/lon is: "adres" = op het
// echte clubadres geocodeerd, "woonplaats" = het middelpunt van de plaats
// (afwijking tot ~2 km, prima voor een straal van 10+ km, niet voor "welke
// club is het dichtst" binnen dezelfde stad). Zie API_REQUIREMENTS.md §7.
export type CoordinaatBron = "adres" | "woonplaats";

// Kan een willekeurige gebruiker hier boeken, of moet je lid zijn / inloggen?
//   true  = bevestigd vrij boekbaar (commerciële clubs: Playtomic, Foys)
//   false = bevestigd achter een inlogmuur of lidmaatschap → NIET tonen in de
//           app, want een baan die je niet kunt boeken is geen vondst
//   null  = nog niet geverifieerd; wordt getoond mét waarschuwing, zodat
//           onbekend niet stilzwijgend als "vrij boekbaar" doorgaat
export type BoekbaarZonderLidmaatschap = boolean | null;

export type Club = {
  id: string;
  naam: string;
  plaats: string;
  banen: number;
  systeem: BoekingSysteem;
  status: string;
  boekingsUrl?: string;
  // Eigen website van de club. Voor ledenclubs is dit de nuttigste "Boek
  // hier"-bestemming: het boekingssysteem zelf zit achter een inlogmuur, maar
  // op de clubsite staat wél hoe je als lid reserveert.
  websiteUrl?: string;
  adres?: string;
  lat: number;
  lon: number;
  coordinaatBron: CoordinaatBron;
  boekbaarZonderLidmaatschap: BoekbaarZonderLidmaatschap;
};

// Eigen profielgegevens (tabel `profiles`). Alles buiten id/email is nullable:
// een bestaand account heeft deze velden nog niet ingevuld.
export type Profiel = {
  voornaam: string | null;
  achternaam: string | null;
  speelsterkte: number | null;
  speelsterkteBron: "handmatig" | "knltb" | null;
  bondsnummer: string | null;
  straat: string | null;
  huisnummer: string | null;
  postcode: string | null;
  woonplaats: string | null;
  lat: number | null;
  lon: number | null;
  zoekstraalKm: number;
  // Verenigingen waar de gebruiker lid is: onze club-id's en/of zelf getypte
  // namen van clubs die nog niet in de app staan.
  lidmaatschappen: string[];
  // Genormaliseerd als +316XXXXXXXX (zie src/lib/telefoon.ts) — optioneel,
  // voor toekomstige sms/WhatsApp-notificaties.
  telefoon: string | null;
};
export type Player = { id: string; naam: string; speelsterkte: number; bondsnummer?: string; };
export type Pair = { spelers: [Player, Player]; gemSterkte: number; };
