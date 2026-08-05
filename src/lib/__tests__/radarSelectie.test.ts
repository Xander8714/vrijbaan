import { describe, expect, it } from "vitest";
import { maakRadarSelectie, MAX_CLUBS_NORMAAL, MAX_CLUBS_VER_VOORUIT } from "../radarSelectie";

const vandaag = new Date(2026, 7, 5, 12, 0);
const clubs = [
  { id: "a", afstandKm: 1 },
  { id: "b", afstandKm: 2 },
  { id: "c", afstandKm: 3 },
  { id: "d", afstandKm: 4 },
  { id: "e", afstandKm: 5 },
  { id: "favoriet-buiten-regio", afstandKm: 120 },
];

describe("maakRadarSelectie", () => {
  it("gebruikt verder vooruit maximaal vier clubs binnen de volledige gekozen straal", () => {
    const selectie = maakRadarSelectie(clubs, 20, new Set(), "2026-08-12", vandaag);

    expect(selectie.maximum).toBe(MAX_CLUBS_VER_VOORUIT);
    expect(selectie.clubsOmTeTonen.map((club) => club.id)).toEqual(["a", "b", "c", "d"]);
    expect(selectie.effectieveStraalKm).toBe(4);
  });

  it("houdt in een dunbevolkt gebied de ruime zoekstraal aan", () => {
    const selectie = maakRadarSelectie(clubs.slice(0, 2), 25, new Set(), "2026-08-12", vandaag);

    expect(selectie.clubsOmTeTonen).toHaveLength(2);
    expect(selectie.effectieveStraalKm).toBe(25);
    expect(selectie.begrensd).toBe(false);
  });

  it("laat een favoriet buiten het actieve zoekgebied niet meetellen", () => {
    const selectie = maakRadarSelectie(
      clubs,
      10,
      new Set(["favoriet-buiten-regio"]),
      "2026-08-12",
      vandaag
    );

    expect(selectie.clubsBinnenStraal.map((club) => club.id)).not.toContain("favoriet-buiten-regio");
    expect(selectie.clubsOmTeTonen.map((club) => club.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("behoudt de normale ruimere selectie binnen het cachevenster", () => {
    const selectie = maakRadarSelectie(clubs, 20, new Set(), "2026-08-07", vandaag);

    expect(selectie.maximum).toBe(MAX_CLUBS_NORMAAL);
    expect(selectie.clubsOmTeTonen).toHaveLength(5);
  });
});
