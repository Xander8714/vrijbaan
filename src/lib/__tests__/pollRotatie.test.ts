import { describe, it, expect } from "vitest";
import {
  bouwOntvangersPerClub,
  kiesRotatieBatch,
  ROTATIE_GROOTTE,
  ROTATIE_BLOK_MINUTEN,
} from "../../../scripts/poll-availability";

describe("kiesRotatieBatch", () => {
  it("geeft een lege lijst bij geen niet-gevolgde clubs", () => {
    expect(kiesRotatieBatch([])).toEqual([]);
  });

  it("geeft alles terug als er minder clubs zijn dan de blokgrootte", () => {
    const clubs = ["a", "b", "c"];
    expect(kiesRotatieBatch(clubs, new Date("2026-07-30T10:00:00Z"))).toEqual(["a", "b", "c"]);
  });

  it("kiest een deelverzameling wanneer er meer clubs zijn dan de blokgrootte", () => {
    const clubs = Array.from({ length: 20 }, (_, i) => `club-${String(i).padStart(2, "0")}`);
    const batch = kiesRotatieBatch(clubs, new Date("2026-07-30T10:00:00Z"));
    expect(batch.length).toBeGreaterThan(0);
    expect(batch.length).toBeLessThanOrEqual(ROTATIE_GROOTTE);
    // Elk gekozen id moet uit de oorspronkelijke lijst komen.
    batch.forEach((id) => expect(clubs).toContain(id));
  });

  it("schuift naar een ander blok naarmate de tijd verstrijkt", () => {
    // 20 clubs / ROTATIE_GROOTTE(8) = 3 blokken van ROTATIE_BLOK_MINUTEN →
    // een sprong van precies één blok laat gegarandeerd een ander blok zien
    // i.p.v. toevallig weer hetzelfde na een veelvoud van de volledige
    // cyclus. Bewust afgeleid van de echte constanten i.p.v. een hardcoded
    // stap — dit brak stil toen het polling-interval van 5 naar 30 min ging
    // terwijl deze test nog 5 minuten sprong (4/5 aug 2026).
    const clubs = Array.from({ length: 20 }, (_, i) => `club-${String(i).padStart(2, "0")}`);
    const start = new Date("2026-07-30T10:00:00Z");
    const eenBlokLater = new Date(start.getTime() + ROTATIE_BLOK_MINUTEN * 60 * 1000);
    const batch1 = kiesRotatieBatch(clubs, start);
    const batch2 = kiesRotatieBatch(clubs, eenBlokLater);
    expect(batch1).not.toEqual(batch2);
  });

  it("geeft hetzelfde blok terug binnen hetzelfde tijdvenster (deterministisch, geen cursor nodig)", () => {
    const clubs = Array.from({ length: 20 }, (_, i) => `club-${String(i).padStart(2, "0")}`);
    const t = new Date("2026-07-30T10:01:23Z");
    expect(kiesRotatieBatch(clubs, t)).toEqual(kiesRotatieBatch(clubs, t));
  });

  it("komt uiteindelijk elke club een keer tegen als de blokken doorlopen", () => {
    const clubs = Array.from({ length: 17 }, (_, i) => `club-${String(i).padStart(2, "0")}`);
    const geziene = new Set<string>();
    const start = new Date("2026-07-30T00:00:00Z").getTime();
    // ceil(17 / ROTATIE_GROOTTE) blokken nodig voor volledige dekking — 10
    // stappen van ROTATIE_BLOK_MINUTEN is ruim voldoende, ongeacht wat die
    // laatste op dit moment toevallig is.
    for (let blok = 0; blok < 10; blok++) {
      kiesRotatieBatch(clubs, new Date(start + blok * ROTATIE_BLOK_MINUTEN * 60 * 1000)).forEach((id) => geziene.add(id));
    }
    clubs.forEach((id) => expect(geziene).toContain(id));
  });
});

describe("bouwOntvangersPerClub", () => {
  const clubs = [
    { id: "haarlem", lat: 52.3874, lon: 4.6462 },
    { id: "beuningen", lat: 51.8505, lon: 5.7530 },
  ];
  const basisProfiel = {
    id: "gebruiker-1",
    chatId: 123,
    voorkeurstijd: null,
    lat: null,
    lon: null,
    straalKm: 10,
  };

  it("stuurt niets zonder favorieten en zonder complete regio", () => {
    expect(bouwOntvangersPerClub([basisProfiel], [], clubs).size).toBe(0);
  });

  it("neemt een favoriete club mee, ook zonder regio", () => {
    const kaart = bouwOntvangersPerClub(
      [basisProfiel],
      [{ userId: basisProfiel.id, clubId: "beuningen" }],
      clubs
    );
    expect([...kaart.keys()]).toEqual(["beuningen"]);
  });

  it("neemt alleen clubs binnen een complete regio en straal mee", () => {
    const kaart = bouwOntvangersPerClub(
      [{ ...basisProfiel, lat: 52.3874, lon: 4.6462, straalKm: 10 }],
      [],
      clubs
    );
    expect([...kaart.keys()]).toEqual(["haarlem"]);
  });

  it("combineert favorieten buiten de regio met clubs binnen de regio zonder dubbelen", () => {
    const kaart = bouwOntvangersPerClub(
      [{ ...basisProfiel, lat: 52.3874, lon: 4.6462, straalKm: 10 }],
      [
        { userId: basisProfiel.id, clubId: "haarlem" },
        { userId: basisProfiel.id, clubId: "beuningen" },
      ],
      clubs
    );
    expect(new Set(kaart.keys())).toEqual(new Set(["haarlem", "beuningen"]));
    expect(kaart.get("haarlem")).toHaveLength(1);
  });
});
