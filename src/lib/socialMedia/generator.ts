import type {
  BeschikbaarheidsKandidaat,
  DagelijkseAvondKandidaat,
  DagelijkseTellingKandidaat,
  EditorialVisual,
  GegenereerdConcept,
  SocialVisual,
} from "./types";

const HERHALINGSVENSTER_DAGEN = 14;
const MAX_TIJDEN_OP_VISUAL = 5;
const MAX_BRON_OUDERDOM_UREN = 2;
const EERSTE_SOCIALMEDIA_STARTTIJD_MINUTEN = 8 * 60;
const LAATSTE_SOCIALMEDIA_STARTTIJD_MINUTEN_EXCLUSIEF = 22 * 60;
const EERSTE_SPITS_STARTTIJD_MINUTEN = 17 * 60;
const LAATSTE_SPITS_STARTTIJD_MINUTEN_INCLUSIEF = 21 * 60 + 30;
const SPITS_MIDDEN_MINUTEN = 19 * 60;

// Onder dit aantal clubs voelt "X clubs hebben nu plek" te mager voor een
// publieke post (5 aug 2026, bij het bouwen van de dagelijkse tellingpost).
const MIN_CLUBS_VOOR_TELLING = 3;

function datumLabel(isoDatum: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(`${isoDatum}T12:00:00+02:00`));
}

function hashtagVanPlaats(plaats: string): string {
  return plaats.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
}

function dagenTussen(van: Date, totIsoDatum: string): number {
  const start = Date.UTC(van.getUTCFullYear(), van.getUTCMonth(), van.getUTCDate());
  const [jaar, maand, dag] = totIsoDatum.split("-").map(Number);
  return Math.round((Date.UTC(jaar, maand - 1, dag) - start) / 86_400_000);
}

/**
 * Nachtelijke beschikbaarheid blijft bruikbaar voor Radar en meldingen, maar
 * is geen zinvol onderwerp voor publieke socialmediacontent. 08:00 telt mee;
 * 22:00 en later niet.
 */
function isGeschikteSocialmediaStarttijd(startTime: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!match) return false;
  const uur = Number(match[1]);
  const minuut = Number(match[2]);
  if (uur > 23 || minuut > 59) return false;
  const minuten = uur * 60 + minuut;
  return (
    minuten >= EERSTE_SOCIALMEDIA_STARTTIJD_MINUTEN &&
    minuten < LAATSTE_SOCIALMEDIA_STARTTIJD_MINUTEN_EXCLUSIEF
  );
}

function isSpitsStarttijd(startTime: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!match) return false;
  const uur = Number(match[1]);
  const minuut = Number(match[2]);
  if (uur > 23 || minuut > 59) return false;
  const minuten = uur * 60 + minuut;
  return minuten >= EERSTE_SPITS_STARTTIJD_MINUTEN && minuten <= LAATSTE_SPITS_STARTTIJD_MINUTEN_INCLUSIEF;
}

function geschikteSocialmediaSloten(kandidaat: BeschikbaarheidsKandidaat): BeschikbaarheidsKandidaat["sloten"] {
  return kandidaat.sloten.filter((slot) => isGeschikteSocialmediaStarttijd(slot.startTime));
}

function relevanteSocialmediaSloten(kandidaat: BeschikbaarheidsKandidaat): BeschikbaarheidsKandidaat["sloten"] {
  const geschikteSloten = geschikteSocialmediaSloten(kandidaat);
  const spitsSloten = geschikteSloten.filter((slot) => isSpitsStarttijd(slot.startTime));
  return spitsSloten.length > 0 ? spitsSloten : geschikteSloten;
}

function score(kandidaat: BeschikbaarheidsKandidaat, nu: Date): number {
  const geschikteTijden = new Set(geschikteSocialmediaSloten(kandidaat).map((slot) => slot.startTime));
  const spitsTijden = [...geschikteTijden].filter(isSpitsStarttijd).length;
  const dagenVooruit = Math.max(0, dagenTussen(nu, kandidaat.datum));
  const ouderdomUren = Math.max(0, (nu.getTime() - new Date(kandidaat.bijgewerktOp).getTime()) / 3_600_000);
  return spitsTijden * 1_000 + geschikteTijden.size * 10 - dagenVooruit * 8 - ouderdomUren;
}

export function kiesInteressantsteBeschikbaarheid(
  kandidaten: BeschikbaarheidsKandidaat[],
  recentGebruikteOnderwerpen: ReadonlySet<string>,
  nu: Date = new Date()
): BeschikbaarheidsKandidaat | null {
  return (
    kandidaten
      .map((kandidaat) => ({ ...kandidaat, sloten: geschikteSocialmediaSloten(kandidaat) }))
      .filter((kandidaat) => kandidaat.sloten.length > 0)
      .filter((kandidaat) => !recentGebruikteOnderwerpen.has(kandidaat.clubId))
      .filter((kandidaat) => dagenTussen(nu, kandidaat.datum) >= 0)
      .filter((kandidaat) => {
        const bijgewerktOp = new Date(kandidaat.bijgewerktOp).getTime();
        return Number.isFinite(bijgewerktOp) && nu.getTime() - bijgewerktOp <= MAX_BRON_OUDERDOM_UREN * 3_600_000;
      })
      .sort((a, b) => score(b, nu) - score(a, nu) || a.clubId.localeCompare(b.clubId))[0] ?? null
  );
}

export function bouwBeschikbaarheidsConcept(kandidaat: BeschikbaarheidsKandidaat): GegenereerdConcept {
  const sloten = relevanteSocialmediaSloten(kandidaat);
  const tijden = [...new Set(sloten.map((slot) => slot.startTime))].sort();
  if (tijden.length === 0) throw new Error("Geen geschikte starttijden tussen 08:00 en 22:00 voor socialmediacontent.");
  const label = datumLabel(kandidaat.datum);
  const plaatsHashtag = hashtagVanPlaats(kandidaat.stad);
  const hashtags = ["padel", "padelbaan", "vrijebaan", plaatsHashtag ? `padel${plaatsHashtag}` : "padelnederland"];
  const caption =
    `Padellen bij ${kandidaat.clubNaam}? 🎾\n\n` +
    `Voor ${label} zien we nu ${tijden.length} vrije ${tijden.length === 1 ? "starttijd" : "starttijden"}: ` +
    `${tijden.slice(0, MAX_TIJDEN_OP_VISUAL).join(", ")}${tijden.length > MAX_TIJDEN_OP_VISUAL ? " en meer" : ""}.\n\n` +
    `Beschikbaarheid kan snel veranderen. Bekijk de actuele tijden en boek direct via De Vrije Baan.\n\n` +
    hashtags.map((tag) => `#${tag}`).join(" ");

  const visual: SocialVisual = {
    template: "availability-v1",
    eyebrow: `VRIJE PADELBAAN • ${kandidaat.stad.toUpperCase()}`,
    headline: kandidaat.clubNaam,
    subline: label,
    times: tijden.slice(0, MAX_TIJDEN_OP_VISUAL),
    cta: "Bekijk live op devrijebaan.nl",
    accent: "court-ball",
  };

  return {
    status: "pending_approval",
    contentType: "availability",
    subjectKey: `availability:${kandidaat.clubId}:${kandidaat.datum}`,
    subjectType: "club",
    subjectId: kandidaat.clubId,
    city: kandidaat.stad,
    clubId: kandidaat.clubId,
    caption,
    hashtags,
    visual,
    dataSnapshot: {
      clubNaam: kandidaat.clubNaam,
      stad: kandidaat.stad,
      datum: kandidaat.datum,
      sloten,
      herhalingsvensterDagen: HERHALINGSVENSTER_DAGEN,
    },
    sourceUpdatedAt: kandidaat.bijgewerktOp,
    platforms: ["instagram", "facebook"],
  };
}

/** "Haarlem", "Haarlem en Amsterdam" of "Haarlem, Amsterdam en Utrecht" — geen kale komma's aan het eind. */
function opsomming(waarden: string[]): string {
  if (waarden.length <= 1) return waarden.join("");
  if (waarden.length === 2) return waarden.join(" en ");
  return `${waarden.slice(0, -1).join(", ")} en ${waarden.at(-1)}`;
}

/**
 * Kiest het tijdstip vandaag waarop de meeste testregio-clubs tegelijk een
 * vrije plek hebben ("automatisch het drukste/interessantste moment", 5 aug
 * 2026, Xander) — i.p.v. één club-en-tijd (kiesInteressantsteBeschikbaarheid
 * hierboven) telt dit hoeveel VERSCHILLENDE clubs op hetzelfde tijdstip iets
 * vrij hebben. `kandidaten` is bewust dezelfde BeschikbaarheidsKandidaat-vorm
 * als hierboven (één rij per club voor vandaag) — geen apart brontype nodig.
 *
 * Belangrijk: de sloten in `club_beschikbaarheid` zijn al gededupliceerd per
 * starttijd óver alle banen van een club heen (zie de dedup-stap in
 * scripts/poll-availability.ts), dus dit telt CLUBS-met-een-vrije-plek, geen
 * banen. Bewust: "banen" zou hier een verzonnen getal zijn (zie ook de
 * dataSnapshot-comment in bouwDagelijkseTellingConcept).
 */
export function kiesDagelijkseTelling(
  kandidaten: BeschikbaarheidsKandidaat[],
  vandaag: string,
  nu: Date = new Date()
): DagelijkseTellingKandidaat | null {
  const perTijd = new Map<string, BeschikbaarheidsKandidaat[]>();

  for (const kandidaat of kandidaten) {
    if (kandidaat.datum !== vandaag) continue;
    const ouderdomUren = Math.max(0, (nu.getTime() - new Date(kandidaat.bijgewerktOp).getTime()) / 3_600_000);
    if (ouderdomUren > MAX_BRON_OUDERDOM_UREN) continue;
    const tijden = new Set(kandidaat.sloten.filter((slot) => isSpitsStarttijd(slot.startTime)).map((slot) => slot.startTime));
    for (const tijd of tijden) {
      const lijst = perTijd.get(tijd) ?? [];
      lijst.push(kandidaat);
      perTijd.set(tijd, lijst);
    }
  }

  let beste: { tijd: string; clubs: BeschikbaarheidsKandidaat[] } | null = null;
  for (const [tijd, clubs] of perTijd) {
    const afstandTotSpitsMidden = Math.abs(
      Number(tijd.slice(0, 2)) * 60 + Number(tijd.slice(3, 5)) - SPITS_MIDDEN_MINUTEN
    );
    const besteAfstandTotSpitsMidden = beste
      ? Math.abs(Number(beste.tijd.slice(0, 2)) * 60 + Number(beste.tijd.slice(3, 5)) - SPITS_MIDDEN_MINUTEN)
      : Number.POSITIVE_INFINITY;
    const beter =
      !beste ||
      clubs.length > beste.clubs.length ||
      (clubs.length === beste.clubs.length && afstandTotSpitsMidden < besteAfstandTotSpitsMidden) ||
      (clubs.length === beste.clubs.length && afstandTotSpitsMidden === besteAfstandTotSpitsMidden && tijd < beste.tijd);
    if (beter) beste = { tijd, clubs };
  }

  if (!beste || beste.clubs.length < MIN_CLUBS_VOOR_TELLING) return null;

  return {
    datum: vandaag,
    tijd: beste.tijd,
    clubs: beste.clubs.map((c) => ({ clubId: c.clubId, clubNaam: c.clubNaam, stad: c.stad })),
    oudsteBijgewerktOp: beste.clubs.reduce(
      (oudste, c) => (c.bijgewerktOp < oudste ? c.bijgewerktOp : oudste),
      beste.clubs[0].bijgewerktOp
    ),
  };
}

function socialmediaStadNaam(stad: string): string {
  return stad === "'s-Gravenhage" ? "Den Haag" : stad;
}

/**
 * Bouwt de dagelijkse avondselectie voor precies drie teststeden. Alleen
 * actuele starttijden van 17:00 t/m 21:30 tellen mee; per stad worden tijden
 * over alle clubs heen gededupliceerd.
 */
export function kiesDagelijkseAvondBeschikbaarheid(
  kandidaten: BeschikbaarheidsKandidaat[],
  vandaag: string,
  nu: Date = new Date()
): DagelijkseAvondKandidaat | null {
  const perStad = new Map<string, { clubIds: Set<string>; tijden: Set<string>; bijgewerktOp: string[] }>();

  for (const kandidaat of kandidaten) {
    if (kandidaat.datum !== vandaag) continue;
    const bijgewerktOp = new Date(kandidaat.bijgewerktOp).getTime();
    if (!Number.isFinite(bijgewerktOp) || nu.getTime() - bijgewerktOp > MAX_BRON_OUDERDOM_UREN * 3_600_000) continue;
    const tijden = kandidaat.sloten.filter((slot) => isSpitsStarttijd(slot.startTime)).map((slot) => slot.startTime);
    if (tijden.length === 0) continue;
    const stad = socialmediaStadNaam(kandidaat.stad);
    const groep = perStad.get(stad) ?? { clubIds: new Set<string>(), tijden: new Set<string>(), bijgewerktOp: [] };
    groep.clubIds.add(kandidaat.clubId);
    tijden.forEach((tijd) => groep.tijden.add(tijd));
    groep.bijgewerktOp.push(kandidaat.bijgewerktOp);
    perStad.set(stad, groep);
  }

  const steden = [...perStad.entries()]
    .sort((a, b) =>
      b[1].tijden.size - a[1].tijden.size ||
      b[1].clubIds.size - a[1].clubIds.size ||
      a[0].localeCompare(b[0], "nl")
    )
    .slice(0, 3);
  if (steden.length < 3) return null;

  return {
    datum: vandaag,
    steden: steden.map(([stad, groep]) => ({
      stad,
      clubIds: [...groep.clubIds].sort(),
      tijden: [...groep.tijden].sort(),
    })),
    oudsteBijgewerktOp: steden
      .flatMap(([, groep]) => groep.bijgewerktOp)
      .reduce((oudste, waarde) => (waarde < oudste ? waarde : oudste)),
  };
}

export function bouwDagelijkseAvondConcept(kandidaat: DagelijkseAvondKandidaat): GegenereerdConcept {
  const label = datumLabel(kandidaat.datum);
  const hashtags = ["padel", "padelbaan", "vrijebaan", "vanavondpadel", "padelnederland"];
  const stadsRegels = kandidaat.steden
    .map((stad) => `📍 ${stad.stad}: ${stad.tijden.join(", ")}`)
    .join("\n");
  const caption =
    `Vanavond nog padellen? 🎾\n\n` +
    `Dit is er voor ${label} tussen 17:00 en 21:30 vrij in drie steden:\n\n` +
    `${stadsRegels}\n\n` +
    `Beschikbaarheid verandert snel. Bekijk de live Radar en boek direct via devrijebaan.nl/radar.\n\n` +
    hashtags.map((tag) => `#${tag}`).join(" ");

  return {
    status: "pending_approval",
    contentType: "availability",
    subjectKey: `daily-evening:${kandidaat.datum}`,
    subjectType: "national",
    subjectId: "daily-evening",
    city: null,
    clubId: null,
    caption,
    hashtags,
    visual: {
      template: "availability-carousel-v1",
      accent: "court-ball",
      slides: kandidaat.steden.map((stad) => ({
        template: "availability-v1",
        eyebrow: "VANAVOND NOG PADELEN?",
        headline: stad.stad,
        subline: `${label} • ${stad.tijden.length} ${stad.tijden.length === 1 ? "tijd" : "tijden"}`,
        times: stad.tijden.slice(0, MAX_TIJDEN_OP_VISUAL),
        cta: "Bekijk live op devrijebaan.nl/radar",
        accent: "court-ball",
      })),
    },
    dataSnapshot: {
      datum: kandidaat.datum,
      venster: { vanaf: "17:00", totEnMet: "21:30" },
      steden: kandidaat.steden,
      selectie: "drie_steden_met_meeste_actuele_avondtijden",
    },
    sourceUpdatedAt: kandidaat.oudsteBijgewerktOp,
    platforms: ["instagram", "facebook"],
  };
}

export function bouwDagelijkseTellingConcept(kandidaat: DagelijkseTellingKandidaat): GegenereerdConcept {
  const steden = opsomming([...new Set(kandidaat.clubs.map((c) => c.stad))]);
  const clubNamen = kandidaat.clubs.map((c) => c.clubNaam);
  const getoondeNamen = clubNamen.slice(0, MAX_TIJDEN_OP_VISUAL);
  const hashtags = ["padel", "padelbaan", "vrijebaan", "padelnederland"];

  const caption =
    `Vandaag om ${kandidaat.tijd} hebben ${kandidaat.clubs.length} clubs in ${steden} nog een padelbaan vrij 🎾\n\n` +
    `Onder andere: ${getoondeNamen.join(", ")}${clubNamen.length > getoondeNamen.length ? " en meer" : ""}.\n\n` +
    `Bekijk live wie er nu plek heeft via de Radar op devrijebaan.nl.\n\n` +
    hashtags.map((tag) => `#${tag}`).join(" ");

  const visual: EditorialVisual = {
    template: "editorial-carousel-v1",
    accent: "court-ball",
    slides: [
      {
        eyebrow: `VANDAAG • LIVE OM ${kandidaat.tijd}`,
        lines: [{ text: `${kandidaat.clubs.length} clubs` }, { text: "hebben nu plek.", accent: true }],
        body: `In ${steden}, live gecheckt.`,
        motif: "radar",
      },
      {
        eyebrow: "ZO GA JE ERNAARTOE",
        lines: [{ text: "Kies je club." }, { text: "Boek direct.", accent: true }],
        chips: getoondeNamen.slice(0, 4),
        cta: "devrijebaan.nl/radar",
        motif: "radar",
      },
    ],
  };

  return {
    status: "pending_approval",
    contentType: "statistic",
    // Per datum i.p.v. per tijdstip — er hoeft maar één actieve tellingpost
    // per dag te zijn, ongeacht welk tijdstip uiteindelijk gekozen werd.
    subjectKey: `daily-count:${kandidaat.datum}`,
    subjectType: "national",
    subjectId: "daily-count",
    city: null,
    clubId: null,
    caption,
    hashtags,
    visual,
    dataSnapshot: {
      datum: kandidaat.datum,
      tijd: kandidaat.tijd,
      aantalClubs: kandidaat.clubs.length,
      clubIds: kandidaat.clubs.map((c) => c.clubId),
      // Expliciet vastgelegd waaróm dit clubs telt en geen banen — zie de
      // uitleg bij kiesDagelijkseTelling hierboven.
      metriek: "aantal_clubs_met_vrije_plek",
    },
    sourceUpdatedAt: kandidaat.oudsteBijgewerktOp,
    platforms: ["instagram", "facebook"],
  };
}

export {
  HERHALINGSVENSTER_DAGEN,
  isGeschikteSocialmediaStarttijd,
  isSpitsStarttijd,
  MAX_BRON_OUDERDOM_UREN,
  MIN_CLUBS_VOOR_TELLING,
};
