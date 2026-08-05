import { describe, expect, it } from "vitest";
import {
  bouwBeschikbaarheidsConcept,
  bouwDagelijkseTellingConcept,
  kiesDagelijkseTelling,
  kiesInteressantsteBeschikbaarheid,
} from "../socialMedia/generator";
import { renderSocialVisualSvg } from "../socialMedia/visual";
import { LAUNCH_CAMPAGNE } from "../socialMedia/campaign";
import { renderSocialVisualJpeg } from "../socialMedia/media";
import sharp from "sharp";
import type { BeschikbaarheidsKandidaat } from "../socialMedia/types";

const basis: BeschikbaarheidsKandidaat = {
  clubId: "club-a",
  clubNaam: "Padel Centrum",
  stad: "Haarlem",
  datum: "2026-08-06",
  bijgewerktOp: "2026-08-05T08:00:00.000Z",
  sloten: [{ startTime: "18:00" }, { startTime: "19:30" }],
};

describe("socialmedia-generator", () => {
  it("kiest veel actuele slots en slaat recent gebruikte clubs over", () => {
    const gekozen = kiesInteressantsteBeschikbaarheid(
      [basis, { ...basis, clubId: "club-b", sloten: [...basis.sloten, { startTime: "20:00" }] }],
      new Set(["club-b"]),
      new Date("2026-08-05T10:00:00.000Z")
    );
    expect(gekozen?.clubId).toBe("club-a");
  });

  it("weigert beschikbaarheid die ouder is dan twee uur", () => {
    const gekozen = kiesInteressantsteBeschikbaarheid(
      [{ ...basis, bijgewerktOp: "2026-08-05T06:00:00.000Z" }],
      new Set(),
      new Date("2026-08-05T10:00:00.000Z")
    );
    expect(gekozen).toBeNull();
  });

  it("bouwt een concept in goedkeuringsmodus met herleidbare snapshot", () => {
    const concept = bouwBeschikbaarheidsConcept(basis);
    expect(concept.status).toBe("pending_approval");
    expect(concept.subjectKey).toBe("availability:club-a:2026-08-06");
    expect(concept.caption).toContain("#padelHaarlem");
    expect(concept.visual.template).toBe("availability-v1");
    if (concept.visual.template !== "availability-v1") throw new Error("Verkeerde visualtemplate");
    expect(concept.visual.times).toEqual(["18:00", "19:30"]);
    expect(concept.dataSnapshot).toMatchObject({ clubNaam: "Padel Centrum", datum: "2026-08-06" });
  });

  it("escaped dynamische tekst in de SVG-template", () => {
    const visual = bouwBeschikbaarheidsConcept(basis).visual;
    if (visual.template !== "availability-v1") throw new Error("Verkeerde visualtemplate");
    const svg = renderSocialVisualSvg({
      ...visual,
      headline: "Club <script>",
    });
    expect(svg).toContain("Club &lt;script&gt;");
    expect(svg).not.toContain("Club <script>");
  });

  it("plant launchposts 2–5 om de drie dagen in goedkeuringsmodus", () => {
    expect(LAUNCH_CAMPAGNE.map((post) => post.strategyPosition)).toEqual([2, 3, 4, 5]);
    const momenten = LAUNCH_CAMPAGNE.map((post) => new Date(post.scheduledFor).getTime());
    expect(momenten.slice(1).map((moment, index) => (moment - momenten[index]) / 86_400_000)).toEqual([3, 3, 3]);
    expect(LAUNCH_CAMPAGNE.every((post) => post.visual.template === "editorial-carousel-v1")).toBe(true);
  });

  it("rendert iedere editorial slide in de bestaande donkere limegroene huisstijl", () => {
    const visual = LAUNCH_CAMPAGNE[0].visual;
    const svg = renderSocialVisualSvg(visual, 1);
    expect(svg).toContain("#06100e");
    expect(svg).toContain("#c7ff22");
    expect(svg).toContain("2/3");
  });

  it("rendert een Meta-geschikte vierkante JPEG", async () => {
    const jpeg = await renderSocialVisualJpeg(LAUNCH_CAMPAGNE[0].visual, 0);
    const metadata = await sharp(jpeg).metadata();
    expect(jpeg.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(metadata).toMatchObject({ format: "jpeg", width: 1080, height: 1080 });
  }, 15_000);
});

describe("dagelijkse tellingpost (5 aug 2026)", () => {
  const vandaag = "2026-08-06";
  const nu = new Date("2026-08-06T12:00:00.000Z");

  // Vier clubs: drie delen 14:00 (de "drukste" tijd), één zit alleen op 18:00.
  const clubs: BeschikbaarheidsKandidaat[] = [
    { clubId: "a", clubNaam: "Club A", stad: "Haarlem", datum: vandaag, bijgewerktOp: "2026-08-06T11:00:00.000Z", sloten: [{ startTime: "14:00" }] },
    { clubId: "b", clubNaam: "Club B", stad: "Haarlem", datum: vandaag, bijgewerktOp: "2026-08-06T11:30:00.000Z", sloten: [{ startTime: "14:00" }, { startTime: "18:00" }] },
    { clubId: "c", clubNaam: "Club C", stad: "Amsterdam", datum: vandaag, bijgewerktOp: "2026-08-06T10:00:00.000Z", sloten: [{ startTime: "14:00" }] },
    { clubId: "d", clubNaam: "Club D", stad: "Utrecht", datum: vandaag, bijgewerktOp: "2026-08-06T11:00:00.000Z", sloten: [{ startTime: "18:00" }] },
  ];

  it("kiest het tijdstip met de meeste clubs, niet het aantal sloten", () => {
    const gekozen = kiesDagelijkseTelling(clubs, vandaag, nu);
    expect(gekozen?.tijd).toBe("14:00");
    expect(gekozen?.clubs.map((c) => c.clubId).sort()).toEqual(["a", "b", "c"]);
  });

  it("gebruikt de oudste bijgewerkt_op van de meegetelde clubs, niet de nieuwste", () => {
    const gekozen = kiesDagelijkseTelling(clubs, vandaag, nu);
    expect(gekozen?.oudsteBijgewerktOp).toBe("2026-08-06T10:00:00.000Z");
  });

  it("negeert clubs van een andere dag of met te oude data", () => {
    const anderDag = { ...clubs[0], clubId: "e", datum: "2026-08-05" };
    const teOud = { ...clubs[1], clubId: "f", bijgewerktOp: "2026-08-06T08:00:00.000Z" }; // > 2 uur voor `nu`
    const gekozen = kiesDagelijkseTelling([...clubs, anderDag, teOud], vandaag, nu);
    expect(gekozen?.clubs.map((c) => c.clubId)).not.toContain("e");
    expect(gekozen?.clubs.map((c) => c.clubId)).not.toContain("f");
  });

  it("geeft null bij te weinig clubs (onder MIN_CLUBS_VOOR_TELLING)", () => {
    const gekozen = kiesDagelijkseTelling(clubs.slice(0, 1), vandaag, nu);
    expect(gekozen).toBeNull();
  });

  it("bouwt een carrousel met het echte cijfer, geen 'banen'-woord", () => {
    const kandidaat = kiesDagelijkseTelling(clubs, vandaag, nu)!;
    const concept = bouwDagelijkseTellingConcept(kandidaat);
    expect(concept.contentType).toBe("statistic");
    expect(concept.subjectKey).toBe(`daily-count:${vandaag}`);
    expect(concept.clubId).toBeNull();
    expect(concept.caption).toContain("3 clubs");
    expect(concept.caption).not.toMatch(/\bbanen\b/i);
    expect(concept.visual.template).toBe("editorial-carousel-v1");
    if (concept.visual.template !== "editorial-carousel-v1") throw new Error("Verkeerde visualtemplate");
    expect(concept.visual.slides).toHaveLength(2);
    expect(concept.dataSnapshot).toMatchObject({ aantalClubs: 3, metriek: "aantal_clubs_met_vrije_plek" });
  });
});
