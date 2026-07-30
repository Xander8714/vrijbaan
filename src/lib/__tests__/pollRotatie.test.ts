import { describe, it, expect } from "vitest";
import { kiesRotatieBatch } from "../../../scripts/poll-availability";

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
    expect(batch.length).toBeLessThanOrEqual(8);
    // Elk gekozen id moet uit de oorspronkelijke lijst komen.
    batch.forEach((id) => expect(clubs).toContain(id));
  });

  it("schuift naar een ander blok naarmate de tijd verstrijkt", () => {
    // 20 clubs / blokgrootte 8 = 3 blokken van 5 min → cyclus van 15 min. Een
    // sprong van 5 min (één blok) laat gegarandeerd een ander blok zien i.p.v.
    // toevallig weer hetzelfde na een veelvoud van de volledige cyclus.
    const clubs = Array.from({ length: 20 }, (_, i) => `club-${String(i).padStart(2, "0")}`);
    const batch1 = kiesRotatieBatch(clubs, new Date("2026-07-30T10:00:00Z"));
    const batch2 = kiesRotatieBatch(clubs, new Date("2026-07-30T10:05:00Z"));
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
    // 5 minuten per blok, dus binnen ruim voldoende blokken moet alles voorbijkomen.
    for (let blok = 0; blok < 10; blok++) {
      kiesRotatieBatch(clubs, new Date(start + blok * 5 * 60 * 1000)).forEach((id) => geziene.add(id));
    }
    clubs.forEach((id) => expect(geziene).toContain(id));
  });
});
