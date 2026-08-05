import { describe, expect, it } from "vitest";
import {
  bouwBeschikbaarheidsConcept,
  bouwDagelijkseAvondConcept,
  bouwDagelijkseTellingConcept,
  isGeschikteSocialmediaStarttijd,
  isSpitsStarttijd,
  kiesDagelijkseAvondBeschikbaarheid,
  kiesDagelijkseTelling,
  kiesInteressantsteBeschikbaarheid,
} from "../socialMedia/generator";
import { controleerSocialVisualSpelling, renderSocialVisualSvg } from "../socialMedia/visual";
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

  it("geeft een club met spitsbeschikbaarheid voorrang boven veel daluren", () => {
    const daluren = {
      ...basis,
      clubId: "club-daluren",
      sloten: ["08:00", "09:00", "10:00", "11:00", "12:00"].map((startTime) => ({ startTime })),
    };
    const spits = { ...basis, clubId: "club-spits", sloten: [{ startTime: "18:30" }] };
    const gekozen = kiesInteressantsteBeschikbaarheid(
      [daluren, spits],
      new Set(),
      new Date("2026-08-05T10:00:00.000Z")
    );
    expect(gekozen?.clubId).toBe("club-spits");
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

  it("neemt alleen starttijden vanaf 08:00 en voor 22:00 mee", () => {
    const metNachtelijkeSloten: BeschikbaarheidsKandidaat = {
      ...basis,
      sloten: [
        { startTime: "00:00" },
        { startTime: "07:30" },
        { startTime: "08:00" },
        { startTime: "21:00" },
        { startTime: "21:30" },
        { startTime: "22:00" },
      ],
    };

    const gekozen = kiesInteressantsteBeschikbaarheid(
      [metNachtelijkeSloten],
      new Set(),
      new Date("2026-08-05T10:00:00.000Z")
    );
    expect(gekozen?.sloten.map((slot) => slot.startTime)).toEqual(["08:00", "21:00", "21:30"]);

    const concept = bouwBeschikbaarheidsConcept(metNachtelijkeSloten);
    if (concept.visual.template !== "availability-v1") throw new Error("Verkeerde visualtemplate");
    expect(concept.visual.times).toEqual(["21:00", "21:30"]);
    expect(concept.caption).toContain("2 vrije starttijden: 21:00, 21:30");
    expect(concept.dataSnapshot.sloten).toEqual([{ startTime: "21:00" }, { startTime: "21:30" }]);
  });

  it("kiest geen club met uitsluitend nachtelijke starttijden", () => {
    const gekozen = kiesInteressantsteBeschikbaarheid(
      [{ ...basis, sloten: [{ startTime: "00:00" }, { startTime: "22:30" }] }],
      new Set(),
      new Date("2026-08-05T10:00:00.000Z")
    );
    expect(gekozen).toBeNull();
  });

  it("hanteert geldige en inclusieve grenzen voor socialmedia-starttijden", () => {
    expect(isGeschikteSocialmediaStarttijd("07:59")).toBe(false);
    expect(isGeschikteSocialmediaStarttijd("08:00")).toBe(true);
    expect(isGeschikteSocialmediaStarttijd("21:59")).toBe(true);
    expect(isGeschikteSocialmediaStarttijd("22:00")).toBe(false);
    expect(isGeschikteSocialmediaStarttijd("25:00")).toBe(false);
  });

  it("behandelt 17:00 tot en met 21:30 als spitstijd", () => {
    expect(isSpitsStarttijd("16:59")).toBe(false);
    expect(isSpitsStarttijd("17:00")).toBe(true);
    expect(isSpitsStarttijd("19:30")).toBe(true);
    expect(isSpitsStarttijd("21:00")).toBe(true);
    expect(isSpitsStarttijd("21:30")).toBe(true);
    expect(isSpitsStarttijd("21:31")).toBe(false);
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

  it("plant launchposts 2–8 om de drie dagen in goedkeuringsmodus", () => {
    // 6-8 toegevoegd 5 aug 2026 (Xander: "wees creatiever", geen live-
    // tijdslot-herhaling meer) — zelfde cadans als 2-5, dus dit is bewust
    // niet meer hardcoded op precies 4 posts.
    expect(LAUNCH_CAMPAGNE.map((post) => post.strategyPosition)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    const momenten = LAUNCH_CAMPAGNE.map((post) => new Date(post.scheduledFor).getTime());
    const tussenpozenInDagen = momenten.slice(1).map((moment, index) => (moment - momenten[index]) / 86_400_000);
    expect(tussenpozenInDagen.every((dagen) => dagen === 3)).toBe(true);
    expect(LAUNCH_CAMPAGNE.every((post) => post.visual.template === "editorial-carousel-v1")).toBe(true);
  });

  it("houdt actuele beschikbaarheidstijden uit de vaste campagneposts", () => {
    const campagneInhoud = LAUNCH_CAMPAGNE.map((post) => JSON.stringify({
      caption: post.caption,
      visual: post.visual,
    })).join("\n");
    expect(campagneInhoud).not.toMatch(/banen beschikbaar om/i);
    expect(campagneInhoud).not.toMatch(/\b[0-2][0-9]:[0-5][0-9]\b/);
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

  // Vier clubs delen 14:00, maar drie daarvan hebben ook om 18:00 plek. De
  // telling moet de relevante spits kiezen en niet het drukkere daluur.
  const clubs: BeschikbaarheidsKandidaat[] = [
    { clubId: "a", clubNaam: "Club A", stad: "Haarlem", datum: vandaag, bijgewerktOp: "2026-08-06T11:00:00.000Z", sloten: [{ startTime: "14:00" }, { startTime: "18:00" }] },
    { clubId: "b", clubNaam: "Club B", stad: "Haarlem", datum: vandaag, bijgewerktOp: "2026-08-06T11:30:00.000Z", sloten: [{ startTime: "14:00" }, { startTime: "18:00" }] },
    { clubId: "c", clubNaam: "Club C", stad: "Amsterdam", datum: vandaag, bijgewerktOp: "2026-08-06T10:00:00.000Z", sloten: [{ startTime: "14:00" }, { startTime: "18:00" }] },
    { clubId: "d", clubNaam: "Club D", stad: "Utrecht", datum: vandaag, bijgewerktOp: "2026-08-06T11:00:00.000Z", sloten: [{ startTime: "14:00" }] },
  ];

  it("kiest de drukste spitstijd en negeert een drukker daluur", () => {
    const gekozen = kiesDagelijkseTelling(clubs, vandaag, nu);
    expect(gekozen?.tijd).toBe("18:00");
    expect(gekozen?.clubs.map((c) => c.clubId).sort()).toEqual(["a", "b", "c"]);
  });

  it("negeert een populair nachtelijk tijdstip bij de dagelijkse telling", () => {
    const metNachtelijkeSloten = clubs.map((club) => ({
      ...club,
      sloten: [...club.sloten, { startTime: "00:00" }],
    }));
    const gekozen = kiesDagelijkseTelling(metNachtelijkeSloten, vandaag, nu);
    expect(gekozen?.tijd).toBe("18:00");
    expect(gekozen?.clubs).toHaveLength(3);
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

describe("dagelijkse 3-steden-avondpost", () => {
  const vandaag = "2026-08-06";
  const nu = new Date("2026-08-06T14:00:00.000Z");
  const kandidaat = (
    clubId: string,
    stad: string,
    tijden: string[],
    bijgewerktOp = "2026-08-06T13:30:00.000Z"
  ): BeschikbaarheidsKandidaat => ({
    clubId,
    clubNaam: clubId,
    stad,
    datum: vandaag,
    bijgewerktOp,
    sloten: tijden.map((startTime) => ({ startTime })),
  });

  const kandidaten = [
    kandidaat("a1", "Amsterdam", ["16:30", "17:00", "18:00", "19:30", "22:00"]),
    kandidaat("h1", "Haarlem", ["18:30", "21:30"]),
    kandidaat("d1", "'s-Gravenhage", ["20:00"], "2026-08-06T13:00:00.000Z"),
    kandidaat("g1", "Groningen", ["20:30"]),
  ];

  it("kiest precies drie steden met de meeste actuele avondtijden", () => {
    const gekozen = kiesDagelijkseAvondBeschikbaarheid(kandidaten, vandaag, nu);
    expect(gekozen?.steden.map((stad) => stad.stad)).toEqual(["Amsterdam", "Haarlem", "Den Haag"]);
    expect(gekozen?.steden[0].tijden).toEqual(["17:00", "18:00", "19:30"]);
    expect(gekozen?.oudsteBijgewerktOp).toBe("2026-08-06T13:00:00.000Z");
  });

  it("bouwt drie slides en een caption met de avondtijden", () => {
    const gekozen = kiesDagelijkseAvondBeschikbaarheid(kandidaten, vandaag, nu)!;
    const concept = bouwDagelijkseAvondConcept(gekozen);
    expect(concept.subjectKey).toBe(`daily-evening:${vandaag}`);
    expect(concept.caption).toContain("tussen 17:00 en 21:30");
    expect(concept.caption).toContain("📍 Amsterdam: 17:00, 18:00, 19:30");
    expect(concept.visual.template).toBe("availability-story-v1");
    if (concept.visual.template !== "availability-story-v1") throw new Error("Verkeerde visualtemplate");
    expect(concept.visual.slides).toHaveLength(3);
    expect(concept.visual.slides[1].headline).toBe("Haarlem");
    expect(concept.visual.slides.every((slide) => slide.eyebrow === "VANAVOND NOG PADELLEN?")).toBe(true);
    expect(JSON.stringify(concept.visual)).not.toMatch(/\bpadelen\b/i);
    expect(renderSocialVisualSvg(concept.visual, 0)).toContain("1/3");
  });

  it("blokkeert de spelfout padelen voordat een visual wordt gerenderd", () => {
    const gekozen = kiesDagelijkseAvondBeschikbaarheid(kandidaten, vandaag, nu)!;
    const concept = bouwDagelijkseAvondConcept(gekozen);
    if (concept.visual.template !== "availability-story-v1") throw new Error("Verkeerde visualtemplate");
    const foutVisual = {
      ...concept.visual,
      slides: concept.visual.slides.map((slide) => ({ ...slide, eyebrow: "VANAVOND NOG PADELEN?" })),
    };

    expect(() => controleerSocialVisualSpelling(foutVisual)).toThrow(/gebruik "padellen"/i);
    expect(() => renderSocialVisualSvg(foutVisual, 0)).toThrow(/gebruik "padellen"/i);
  });

  it("maakt geen dagpost als minder dan drie steden avondbeschikbaarheid hebben", () => {
    expect(kiesDagelijkseAvondBeschikbaarheid(kandidaten.slice(0, 2), vandaag, nu)).toBeNull();
  });

  it("rendert de dagelijkse kaarten als verticale 9:16 Story-JPEG", async () => {
    const gekozen = kiesDagelijkseAvondBeschikbaarheid(kandidaten, vandaag, nu)!;
    const concept = bouwDagelijkseAvondConcept(gekozen);
    const jpeg = await renderSocialVisualJpeg(concept.visual, 0);
    const metadata = await sharp(jpeg).metadata();
    expect(metadata).toMatchObject({ format: "jpeg", width: 1080, height: 1920 });
  }, 15_000);

  it("kan een gecontroleerde vervangende Story-set voor dezelfde dag maken", () => {
    const gekozen = kiesDagelijkseAvondBeschikbaarheid(kandidaten, vandaag, nu)!;
    expect(bouwDagelijkseAvondConcept(gekozen, "spellingfix-1").subjectKey)
      .toBe(`daily-evening:${vandaag}:spellingfix-1`);
    expect(() => bouwDagelijkseAvondConcept(gekozen, "ONGELDIG!")).toThrow(/correctiesleutel/i);
  });
});
