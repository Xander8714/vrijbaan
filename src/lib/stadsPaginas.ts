/**
 * Data voor de statische /padelbaan-vrij/<stad>-landingspagina's (4 aug
 * 2026) — Xander, na een SEO-review: losse, blijvende pagina's per stad met
 * genoeg commerciële aanbieders om de moeite waard te zijn (i.t.t. een dorp
 * met precies één vereniging, waar iedereen toch al weet waar hij moet
 * zijn). Bewust een kleine, met de hand gekozen lijst i.p.v. alle 370
 * plaatsnamen uit CLUBS — alleen steden waar VrijeBaan echt iets toevoegt.
 *
 * Volgorde/keuze (bijgewerkt 4 aug 2026, Xander): Apeldoorn en Eindhoven
 * eruit — "daar ken ik toch geen testers", en het GTM-plan is bewust warm/
 * lokaal (vrienden/familie), niet landelijke SEO naar vreemdelingen in
 * steden zonder eigen netwerk. Den Haag en Rijswijk erbij: "daar zit een
 * grote groep vrienden [en familie]". Resultaat: Amsterdam, Haarlem,
 * Groningen, Utrecht, Den Haag, Rijswijk.
 *
 * Cijfers worden hier NIET hardcoded maar bij elke build herberekend uit
 * CLUBS_INCLUSIEF_LEDENCLUBS — zo lopen ze nooit uit de pas met de
 * werkelijke clubdata (zelfde principe als TOTAAL_BANEN op de homepage).
 */
import { CLUBS_INCLUSIEF_LEDENCLUBS } from "./clubs";
import type { Club } from "./types";
import { afgerondeAfstand } from "./geo";

export type StadSlug = "amsterdam" | "haarlem" | "groningen" | "utrecht" | "denhaag" | "rijswijk";

/**
 * slug -> exacte `plaats`-waarde(n) uit clubs.ts. Meestal 1-op-1, maar Den
 * Haag staat in de clubdata onder TWEE verschillende plaatsnamen: de Foys-
 * vestiging (Peakz Benoordenhout) heeft "Den Haag", de drie Playtomic-clubs
 * hebben "'s-Gravenhage" (zo geeft PDOK die geocodeert) — allebei dezelfde
 * stad, dus allebei meenemen, anders mist de pagina 3 van de 4 clubs.
 */
const STAD_PLAATSNAMEN: Record<StadSlug, string[]> = {
  amsterdam: ["Amsterdam"],
  haarlem: ["Haarlem"],
  groningen: ["Groningen"],
  utrecht: ["Utrecht"],
  denhaag: ["Den Haag", "'s-Gravenhage"],
  rijswijk: ["Rijswijk"],
};

/** Weergavenaam + korte, met de hand geschreven intro per stad — geen sjabloontekst. */
const STAD_INFO: Record<StadSlug, { naam: string; intro: string }> = {
  amsterdam: {
    naam: "Amsterdam",
    intro:
      "Amsterdam heeft verreweg het grootste padelaanbod van Nederland: van de vier Peakz-vestigingen tot indoorclubs als B. Amsterdam en NDSM Padel. Met zoveel losse aanbieders door elkaar is handmatig alles nalopen niet te doen — precies waar de Radar voor bedoeld is.",
  },
  haarlem: {
    naam: "Haarlem",
    intro:
      "Haarlem is waar VrijeBaan is begonnen, en niet toevallig: met WePadel (de grootste outdoor padelclub van Nederland), PADEL25, Schoten, TPV Pim Mulier, Peakz en Racketclub Overhout zit hier een compacte stad met alle vier de grote boekingssystemen tegelijk.",
  },
  groningen: {
    naam: "Groningen",
    intro:
      "Groningen heeft drie Peakz-vestigingen (Atoomweg, Euroborg en Suikerterrein) met samen bijna 30 banen. Als studentenstad met veel wisselende speeltijden is dit precies het soort aanbod waar een melding zodra er iets vrijkomt het verschil maakt.",
  },
  utrecht: {
    naam: "Utrecht",
    intro:
      "In Utrecht zijn de twee grote Peakz-locaties (Vechtsebanen en Zeehaenkade) samen goed voor 28 banen. Een centraal gelegen stad met veel forensen en flexibele speeltijden — vandaar dat losse boekingen hier vaak voorkomen.",
  },
  denhaag: {
    naam: "Den Haag",
    intro:
      "Den Haag combineert één Peakz-vestiging (Benoordenhout) met drie Playtomic-clubs verspreid over de stad — Nieuw Marlot, Sportcentrum Mariahoeve en Padelcentrum Leeuwenbergh. Vier clubs, twee systemen: zonder VrijeBaan moet je zelf tussen Foys en Playtomic heen en weer schakelen om te zien wat er vrij is.",
  },
  rijswijk: {
    naam: "Rijswijk",
    intro:
      "Rijswijk heeft twee Playtomic-clubs vlak bij elkaar: HELLO Padel op Estate en Plaza Padel Rijswijk, samen 14 banen. Klein genoeg om in één oogopslag te overzien, maar groot genoeg dat het verschil maakt of je precies weet welke van de twee nu een vrij gaatje heeft.",
  },
};

export type StadData = {
  slug: StadSlug;
  naam: string;
  intro: string;
  clubs: Club[];
  totaalBanen: number;
  systemen: string[];
  centrum: { lat: number; lon: number };
};

export const STAD_SLUGS = Object.keys(STAD_PLAATSNAMEN) as StadSlug[];

export function haalStadData(slug: StadSlug): StadData {
  const plaatsnamen = new Set(STAD_PLAATSNAMEN[slug]);
  const clubs = CLUBS_INCLUSIEF_LEDENCLUBS.filter((c) => plaatsnamen.has(c.plaats));
  const totaalBanen = clubs.reduce((som, c) => som + c.banen, 0);
  const systemen = [...new Set(clubs.map((c) => c.systeem))];
  const centrum = {
    lat: clubs.reduce((som, c) => som + c.lat, 0) / clubs.length,
    lon: clubs.reduce((som, c) => som + c.lon, 0) / clubs.length,
  };
  return { slug, naam: STAD_INFO[slug].naam, intro: STAD_INFO[slug].intro, clubs, totaalBanen, systemen, centrum };
}

/** "1 boekingssysteem" / "3 boekingssystemen" — voorkomt fout enkelvoud bij steden met precies 1 systeem (bv. Groningen). */
export function boekingssystemenTekst(aantal: number): string {
  return `${aantal} ${aantal === 1 ? "boekingssysteem" : "boekingssystemen"}`;
}

/** Clubs gesorteerd op afstand tot het stadscentrum — voor een nette weergave. */
export function clubsOpAfstand(stad: StadData): (Club & { afstandKm: number })[] {
  return stad.clubs
    .map((c) => ({ ...c, afstandKm: afgerondeAfstand(stad.centrum, c) }))
    .sort((a, b) => a.afstandKm - b.afstandKm);
}
