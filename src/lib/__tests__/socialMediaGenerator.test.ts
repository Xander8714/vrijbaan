import { describe, expect, it } from "vitest";
import { bouwBeschikbaarheidsConcept, kiesInteressantsteBeschikbaarheid } from "../socialMedia/generator";
import { renderSocialVisualSvg } from "../socialMedia/visual";
import { LAUNCH_CAMPAGNE } from "../socialMedia/campaign";
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
});
