import { describe, it, expect } from "vitest";
import { begrensZoekstraalVoorDatum, naarMinuten, binnenTijdvenster, komendeDagen, dagLabel } from "../tijd";

describe("naarMinuten", () => {
  it("rekent uren en minuten om", () => {
    expect(naarMinuten("00:00")).toBe(0);
    expect(naarMinuten("19:00")).toBe(1140);
    expect(naarMinuten("7:30")).toBe(450);
    expect(naarMinuten("23:59")).toBe(1439);
  });

  it("weigert onzin i.p.v. NaN terug te geven", () => {
    expect(naarMinuten("24:00")).toBeNull();
    expect(naarMinuten("19:60")).toBeNull();
    expect(naarMinuten("19u00")).toBeNull();
    expect(naarMinuten("")).toBeNull();
  });
});

describe("binnenTijdvenster", () => {
  it("neemt tijden binnen de marge mee, inclusief de grenzen", () => {
    expect(binnenTijdvenster("19:00", "19:00", 2)).toBe(true);
    expect(binnenTijdvenster("17:00", "19:00", 2)).toBe(true);
    expect(binnenTijdvenster("21:00", "19:00", 2)).toBe(true);
    expect(binnenTijdvenster("20:30", "19:00", 2)).toBe(true);
  });

  it("laat tijden buiten de marge vallen", () => {
    expect(binnenTijdvenster("16:59", "19:00", 2)).toBe(false);
    expect(binnenTijdvenster("21:01", "19:00", 2)).toBe(false);
    expect(binnenTijdvenster("08:00", "19:00", 2)).toBe(false);
  });

  it("slaat niet om over middernacht", () => {
    // 01:00 is geen alternatief voor 23:00, ook al is het "2 uur later".
    expect(binnenTijdvenster("01:00", "23:00", 2)).toBe(false);
    expect(binnenTijdvenster("21:00", "23:00", 2)).toBe(true);
  });

  it("is onwaar bij een ongeldige invoer", () => {
    expect(binnenTijdvenster("kwart voor acht", "19:00", 2)).toBe(false);
    expect(binnenTijdvenster("19:00", "", 2)).toBe(false);
  });
});

describe("komendeDagen", () => {
  it("geeft vandaag + 2 dagen als ISO-datums", () => {
    expect(komendeDagen(3, new Date(2026, 6, 29))).toEqual(["2026-07-29", "2026-07-30", "2026-07-31"]);
  });

  it("gebruikt standaard een week vooruit (DAGEN_VOORUIT)", () => {
    expect(komendeDagen(undefined, new Date(2026, 6, 29))).toHaveLength(7);
  });

  it("rolt netjes over een maandgrens", () => {
    expect(komendeDagen(3, new Date(2026, 6, 30))).toEqual(["2026-07-30", "2026-07-31", "2026-08-01"]);
  });

  it("gebruikt de lokale datum, ook 's avonds laat", () => {
    // Met toISOString() zou 22:30 Nederlandse zomertijd op 29 juli de UTC-dag
    // 29 juli geven — hier per definitie de lokale dag.
    expect(komendeDagen(1, new Date(2026, 6, 29, 22, 30))).toEqual(["2026-07-29"]);
  });
});

describe("dagLabel", () => {
  it("gebruikt woorden voor de eerste drie dagen", () => {
    expect(dagLabel("2026-07-29", 0)).toBe("Vandaag");
    expect(dagLabel("2026-07-30", 1)).toBe("Morgen");
    expect(dagLabel("2026-07-31", 2)).toBe("Overmorgen");
  });

  it("valt daarna terug op een korte datum", () => {
    expect(dagLabel("2026-08-01", 3)).toMatch(/aug/);
  });
});

describe("begrensZoekstraalVoorDatum", () => {
  const vandaag = new Date(2026, 7, 5, 12, 0);

  it("behoudt de gekozen straal binnen het driedaagse cachevenster", () => {
    expect(begrensZoekstraalVoorDatum(10, "2026-08-07", vandaag)).toBe(10);
  });

  it("begrenst een grote straal verder vooruit tot 5 km", () => {
    expect(begrensZoekstraalVoorDatum(10, "2026-08-12", vandaag)).toBe(5);
  });

  it("vergroot een al kleine straal niet", () => {
    expect(begrensZoekstraalVoorDatum(4, "2026-08-12", vandaag)).toBe(4);
  });
});
