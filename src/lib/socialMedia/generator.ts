import type {
  BeschikbaarheidsKandidaat,
  GegenereerdConcept,
  SocialVisual,
} from "./types";

const HERHALINGSVENSTER_DAGEN = 14;
const MAX_TIJDEN_OP_VISUAL = 5;
const MAX_BRON_OUDERDOM_UREN = 2;

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

export { HERHALINGSVENSTER_DAGEN, MAX_BRON_OUDERDOM_UREN };
