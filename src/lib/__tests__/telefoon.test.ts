import { describe, it, expect } from "vitest";
import { normaliseerMobielNummer, isGeldigMobielNummer, toonMobielNummer } from "../telefoon";

describe("normaliseerMobielNummer", () => {
  it("accepteert 06-formaat", () => {
    expect(normaliseerMobielNummer("0612345678")).toBe("+31612345678");
  });

  it("accepteert 06 met spaties en streepjes", () => {
    expect(normaliseerMobielNummer("06-1234 5678")).toBe("+31612345678");
    expect(normaliseerMobielNummer("06 12 34 56 78")).toBe("+31612345678");
  });

  it("accepteert +31-formaat, met en zonder spatie na de landcode", () => {
    expect(normaliseerMobielNummer("+31612345678")).toBe("+31612345678");
    expect(normaliseerMobielNummer("+31 6 12345678")).toBe("+31612345678");
  });

  it("accepteert 0031-formaat", () => {
    expect(normaliseerMobielNummer("0031612345678")).toBe("+31612345678");
  });

  it("accepteert kaal zonder voorloop-nul (6XXXXXXXX)", () => {
    expect(normaliseerMobielNummer("612345678")).toBe("+31612345678");
  });

  it("geeft null voor een vast nummer (geen mobiel)", () => {
    expect(normaliseerMobielNummer("0231234567")).toBeNull(); // 023 = Haarlem vast net
    expect(normaliseerMobielNummer("+31231234567")).toBeNull();
  });

  it("geeft null voor te weinig of te veel cijfers", () => {
    expect(normaliseerMobielNummer("06123456")).toBeNull();
    expect(normaliseerMobielNummer("061234567890")).toBeNull();
  });

  it("geeft null voor lege invoer", () => {
    expect(normaliseerMobielNummer("")).toBeNull();
    expect(normaliseerMobielNummer("   ")).toBeNull();
  });

  it("geeft null voor onzin-invoer", () => {
    expect(normaliseerMobielNummer("abc")).toBeNull();
  });
});

describe("isGeldigMobielNummer", () => {
  it("volgt normaliseerMobielNummer", () => {
    expect(isGeldigMobielNummer("0612345678")).toBe(true);
    expect(isGeldigMobielNummer("0231234567")).toBe(false);
  });
});

describe("toonMobielNummer", () => {
  it("zet het genormaliseerde formaat om naar een leesbare 06-weergave", () => {
    expect(toonMobielNummer("+31612345678")).toBe("06 1234 5678");
  });

  it("geeft de invoer terug als die niet genormaliseerd is", () => {
    expect(toonMobielNummer("iets anders")).toBe("iets anders");
  });
});
