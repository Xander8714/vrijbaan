import type {
  BeschikbaarheidsKandidaat,
  DagelijkseTellingKandidaat,
  EditorialVisual,
  GegenereerdConcept,
  SocialVisual,
} from "./types";

const HERHALINGSVENSTER_DAGEN = 14;
const MAX_TIJDEN_OP_VISUAL = 5;
const MAX_BRON_OUDERDOM_UREN = 2;

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

function score(kandidaat: BeschikbaarheidsKandidaat, nu: Date): number {
  const uniekeTijden = new Set(kandidaat.sloten.map((slot) => slot.startTime)).size;
  const dagenVooruit = Math.max(0, dagenTussen(nu, kandidaat.datum));
  const ouderdomUren = Math.max(0, (nu.getTime() - new Date(kandidaat.bijgewerktOp).getTime()) / 3_600_000);
  return uniekeTijden * 100 - dagenVooruit * 8 - ouderdomUren;
}

export function kiesInteressantsteBeschikbaarheid(
  kandidaten: BeschikbaarheidsKandidaat[],
  recentGebruikteOnderwerpen: ReadonlySet<string>,
  nu: Date = new Date()
): BeschikbaarheidsKandidaat | null {
  return (
    kandidaten
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
  const tijden = [...new Set(kandidaat.sloten.map((slot) => slot.startTime))].sort();
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
      sloten: kandidaat.sloten,
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
    const tijden = new Set(kandidaat.sloten.map((slot) => slot.startTime));
    for (const tijd of tijden) {
      const lijst = perTijd.get(tijd) ?? [];
      lijst.push(kandidaat);
      perTijd.set(tijd, lijst);
    }
  }

  let beste: { tijd: string; clubs: BeschikbaarheidsKandidaat[] } | null = null;
  for (const [tijd, clubs] of perTijd) {
    const beter =
      !beste ||
      clubs.length > beste.clubs.length ||
      (clubs.length === beste.clubs.length && tijd < beste.tijd); // deterministische tie-break: vroegste tijd wint
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

export { HERHALINGSVENSTER_DAGEN, MAX_BRON_OUDERDOM_UREN, MIN_CLUBS_VOOR_TELLING };
