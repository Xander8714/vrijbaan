import { describe, it, expect } from "vitest";
import { alleKoppelIndelingen, naarPairs, sorteerOpSterkte, winkans, besteOpstelling } from "../lineup";
import { Player } from "../types";

const speler = (naam: string, speelsterkte: number): Player => ({ id: naam, naam, speelsterkte });

describe("alleKoppelIndelingen", () => {
  it("genereert 3 indelingen voor 4 spelers", () => {
    expect(alleKoppelIndelingen([speler("A",1),speler("B",2),speler("C",3),speler("D",4)])).toHaveLength(3);
  });
  it("genereert 15 indelingen voor 6 spelers", () => {
    expect(alleKoppelIndelingen(Array.from({length:6},(_,i)=>speler(`S${i}`,i+1)))).toHaveLength(15);
  });
  it("gooit een fout bij een oneven aantal spelers", () => {
    expect(() => alleKoppelIndelingen([speler("A",1),speler("B",2),speler("C",3)])).toThrow();
  });
});

describe("sorteerOpSterkte", () => {
  it("zet het sterkste koppel eerst", () => {
    const pairs = naarPairs([[speler("A",8),speler("B",9)],[speler("C",1),speler("D",2)]]);
    const gesorteerd = sorteerOpSterkte(pairs);
    expect(gesorteerd[0].gemSterkte).toBeLessThan(gesorteerd[1].gemSterkte);
  });
});

describe("winkans", () => {
  it("geeft 50% bij gelijke sterkte", () => { expect(winkans(5,5)).toBeCloseTo(0.5,5); });
  it("geeft hogere winkans aan het sterkere koppel", () => {
    expect(winkans(2,8)).toBeGreaterThan(0.5);
    expect(winkans(8,2)).toBeLessThan(0.5);
  });
});

describe("besteOpstelling", () => {
  it("respecteert afnemende speelsterkte", () => {
    const r = besteOpstelling([speler("A",3),speler("B",4),speler("C",7),speler("D",8)]);
    for (let i=1;i<r.pairs.length;i++) expect(r.pairs[i].gemSterkte).toBeGreaterThanOrEqual(r.pairs[i-1].gemSterkte);
  });
  it("kiest indeling met hoogste verwachte score tegen bekende tegenstander", () => {
    const r = besteOpstelling([speler("A",1),speler("B",9),speler("C",5),speler("D",5)],[speler("X",5),speler("Y",5),speler("Z",5),speler("W",5)]);
    expect(r.verwachtWinpercentage).toBeGreaterThan(0);
    expect(r.perWedstrijd).toHaveLength(2);
  });
  it("gooit een fout bij oneven aantal spelers", () => {
    expect(() => besteOpstelling([speler("A",1),speler("B",2),speler("C",3)])).toThrow();
  });
});
