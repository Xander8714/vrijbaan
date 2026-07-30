import { describe, it, expect } from "vitest";
import { boekingsBestemming } from "../boekingsLink";
import type { Club } from "../types";

function club(extra: Partial<Club>): Club {
  return {
    id: "test",
    naam: "Testclub",
    plaats: "Haarlem",
    banen: 4,
    systeem: "Playtomic",
    status: "Actief",
    lat: 52.38,
    lon: 4.64,
    coordinaatBron: "adres",
    boekbaarZonderLidmaatschap: true,
    ...extra,
  };
}

describe("boekingsBestemming", () => {
  it("zet de datum in de Playtomic-link", () => {
    const b = boekingsBestemming(
      club({ systeem: "Playtomic", boekingsUrl: "https://playtomic.com/clubs/wepadel-haarlem" }),
      "2026-07-30",
      "12:00"
    );
    expect(b?.url).toBe("https://playtomic.com/clubs/wepadel-haarlem?date=2026-07-30");
    expect(b?.datumInUrl).toBe(true);
    // Playtomic heeft geen per-slot URL — dat mag de UI niet suggereren.
    expect(b?.tijdInUrl).toBe(false);
    expect(b?.nogZelfDoen.join(" ")).toContain("12:00");
  });

  it("hangt de datum met & aan als de URL al een query heeft", () => {
    const b = boekingsBestemming(
      club({ systeem: "Playtomic", boekingsUrl: "https://playtomic.com/clubs/x?utm=1" }),
      "2026-08-01",
      "19:00"
    );
    expect(b?.url).toBe("https://playtomic.com/clubs/x?utm=1&date=2026-08-01");
  });

  it("stuurt Foys naar de vestigingspagina zonder datum in de URL", () => {
    const b = boekingsBestemming(
      club({ systeem: "Foys", boekingsUrl: "https://www.peakzpadel.nl/locaties/haarlem/haarlemmerstroom" }),
      "2026-07-30",
      "12:00"
    );
    expect(b?.url).toBe("https://www.peakzpadel.nl/locaties/haarlem/haarlemmerstroom");
    expect(b?.datumInUrl).toBe(false);
    expect(b?.nogZelfDoen.some((s) => s.includes("2026-07-30"))).toBe(true);
  });

  it("waarschuwt bij een ongeverifieerde Meet & Play-club dat lidmaatschap nog niet is nagegaan", () => {
    const b = boekingsBestemming(
      club({ systeem: "Meet & Play", boekingsUrl: "https://meetandplay.nl/club/00000", boekbaarZonderLidmaatschap: null }),
      "2026-07-30",
      "10:30"
    );
    expect(b?.datumInUrl).toBe(false);
    expect(b?.nogZelfDoen.join(" ")).toContain("nog niet geverifieerd");
  });

  it("wijst bij een bevestigde Meet & Play-club (Hofgeest) op het gratis KNLTB ID, niet op lidmaatschap", () => {
    const b = boekingsBestemming(
      club({ systeem: "Meet & Play", boekingsUrl: "https://meetandplay.nl/club/29942", boekbaarZonderLidmaatschap: true }),
      "2026-07-30",
      "10:30"
    );
    expect(b?.nogZelfDoen.join(" ")).toContain("KNLTB ID");
    expect(b?.nogZelfDoen.join(" ")).not.toContain("nog niet geverifieerd");
  });

  it("valt terug op de clubsite als er geen boekingsUrl is", () => {
    const b = boekingsBestemming(
      club({ systeem: "Baanreserveren", boekingsUrl: undefined, websiteUrl: "https://www.rcoverhout.nl" }),
      "2026-07-30",
      "20:00"
    );
    expect(b?.url).toBe("https://www.rcoverhout.nl");
  });

  it("geeft null als we helemaal geen link kennen", () => {
    expect(boekingsBestemming(club({ boekingsUrl: undefined, websiteUrl: undefined }), "2026-07-30", "12:00")).toBeNull();
  });
});
