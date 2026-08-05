import { describe, it, expect } from "vitest";
import {
  bevatVerbodenActie,
  extraheerFlexibeleTijd,
  extraheerKalenderdatum,
  extraheerStraal,
  extraheerWeekdagen,
  parseAdhocZoekopdracht,
  parseProfielWijzigingen,
  parseVastMomentOpdracht,
} from "../telegramConversatie";
import { MAX_DAGEN_VOORUIT_ZOEKEN } from "../tijd";

describe("extraheerFlexibeleTijd", () => {
  it("herkent compacte 3- en 4-cijferige tijden", () => {
    expect(extraheerFlexibeleTijd("zet mijn tijd op 2000", "profiel")).toBe("20:00");
    expect(extraheerFlexibeleTijd("verander mijn tijd naar 830", "profiel")).toBe("08:30");
  });

  it("herkent dubbelepunt- en losse-uur-vormen", () => {
    expect(extraheerFlexibeleTijd("zet mijn tijd op 20:00", "profiel")).toBe("20:00");
    expect(extraheerFlexibeleTijd("zet mijn tijd op 20", "profiel")).toBe("20:00");
  });

  it("accepteert een kaal antwoord alleen in context tijdantwoord", () => {
    expect(extraheerFlexibeleTijd("2000", "tijdantwoord")).toBe("20:00");
    expect(extraheerFlexibeleTijd("830", "tijdantwoord")).toBe("08:30");
    expect(extraheerFlexibeleTijd("8", "tijdantwoord")).toBe("08:00");
    // Zonder tijdantwoord-context is een kaal getal te dubbelzinnig (zou ook
    // een straal of iets anders kunnen zijn).
    expect(extraheerFlexibeleTijd("2000", "profiel")).toBeNull();
  });

  it("geeft null bij geen-voorkeur-achtige tekst", () => {
    expect(extraheerFlexibeleTijd("geen voorkeur", "tijdantwoord")).toBeNull();
  });
});

describe("extraheerStraal", () => {
  it("herkent straal/zoekstraal-opdrachten", () => {
    expect(extraheerStraal("maak mijn straal 5 km")).toBe(5);
    expect(extraheerStraal("zet zoekstraal op 12")).toBe(12);
  });

  it("geeft null zonder straal-signaal", () => {
    expect(extraheerStraal("zoek een baan in Haarlem")).toBeNull();
  });
});

describe("extraheerWeekdagen", () => {
  it("herkent volledige namen en afkortingen, en sorteert maandag-eerst", () => {
    expect(extraheerWeekdagen("zet woensdag en maandag als vast moment")).toEqual([1, 3]);
    expect(extraheerWeekdagen("di en vr")).toEqual([2, 5]);
  });

  it("herkent werkdagen/weekend/elke dag", () => {
    expect(extraheerWeekdagen("werkdagen")).toEqual([1, 2, 3, 4, 5]);
    expect(extraheerWeekdagen("weekend")).toEqual([6, 0]);
    expect(extraheerWeekdagen("elke dag")).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});

describe("extraheerKalenderdatum (5 aug 2026)", () => {
  const nu = new Date("2026-08-05T12:00:00");

  it("herkent 'D maandnaam' en berekent het juiste aantal dagen vooruit", () => {
    expect(extraheerKalenderdatum("zoek 19 augustus een baan in haarlem om 2030", nu)).toEqual({ offset: 14, teVer: false });
    expect(extraheerKalenderdatum("6 augustus", nu)).toEqual({ offset: 1, teVer: false });
  });

  it("wijst een datum verder dan MAX_DAGEN_VOORUIT_ZOEKEN expliciet af i.p.v. stilzwijgend null", () => {
    const resultaat = extraheerKalenderdatum("zoek 1 oktober een baan in Haarlem", nu);
    expect(resultaat).toEqual({ offset: null, teVer: true });
  });

  it("rekent een al-voorbije datum dit jaar door naar volgend jaar", () => {
    // 1 januari ligt vanaf 5 augustus altijd in het verleden dit jaar.
    const resultaat = extraheerKalenderdatum("1 januari", nu);
    expect(resultaat).toEqual({ offset: null, teVer: true }); // ligt >MAX_DAGEN_VOORUIT_ZOEKEN weg (volgend jaar)
  });

  it("geeft null zonder herkenbare kalenderdatum", () => {
    expect(extraheerKalenderdatum("zoek een baan in Haarlem morgen", nu)).toBeNull();
  });
});

describe("parseAdhocZoekopdracht met kalenderdatum (5 aug 2026)", () => {
  const nu = new Date("2026-08-05T12:00:00");

  it("herkent de exacte casus uit Xanders melding", () => {
    const r = parseAdhocZoekopdracht("zoek 19 augustus een baan in haarlem om 2030", nu);
    expect(r?.plaatsQuery.toLowerCase()).toContain("haarlem");
    expect(r?.dagOffset).toBe(14);
    expect(r?.fout).toBeUndefined();
  });

  it("geeft een duidelijke fout i.p.v. stilzwijgend een andere dag te zoeken", () => {
    const r = parseAdhocZoekopdracht("zoek een baan in Haarlem op 1 oktober", nu);
    expect(r?.fout).toContain(String(MAX_DAGEN_VOORUIT_ZOEKEN));
    expect(r?.dagOffset).toBeNull();
  });
});

describe("bevatVerbodenActie", () => {
  it("blokkeert telefoonnummer- en accountacties", () => {
    expect(bevatVerbodenActie("wijzig mijn telefoonnummer naar 0612345678")).toBe(true);
    expect(bevatVerbodenActie("verwijder mijn account")).toBe(true);
    expect(bevatVerbodenActie("maak mij admin")).toBe(true);
  });

  it("laat normale profielwijzigingen met rust", () => {
    expect(bevatVerbodenActie("maak mijn straal 5 km")).toBe(false);
    expect(bevatVerbodenActie("zet mijn tijd op 2000")).toBe(false);
  });
});

describe("parseProfielWijzigingen", () => {
  it("herkent straal, tijd en locatie door elkaar in één bericht", () => {
    const r = parseProfielWijzigingen("maak straal 5 km en zet mijn tijd op 2000");
    expect(r.herkend).toBe(true);
    expect(r.wijzigingen.straalKm).toBe(5);
    expect(r.wijzigingen.voorkeurstijd).toBe("20:00");
  });

  it("herkent locatiewijziging", () => {
    const r = parseProfielWijzigingen("verander mijn locatie naar Leiden");
    expect(r.wijzigingen.locatieQuery).toBe("leiden");
  });

  it("geeft een foutmelding bij een straal buiten de toegestane grenzen", () => {
    const r = parseProfielWijzigingen("maak mijn straal 500 km");
    expect(r.fout).toBeDefined();
  });

  /**
   * Regressietest voor de bug die tijdens het bouwen (5 aug 2026) opdook:
   * een losse zoekopdracht met "rond"/"om" mag NOOIT als tijd-profielwijziging
   * gelezen worden, anders overschrijft een eenmalige zoekvraag stilzwijgend
   * de persoonlijke voorkeurstijd i.p.v. gewoon een zoekopdracht te zijn.
   */
  it("herkent een losse zoekopdracht met 'rond'/'om' NIET als tijdwijziging", () => {
    expect(parseProfielWijzigingen("zoek een baan in Haarlem rond 20:00").herkend).toBe(false);
    expect(parseProfielWijzigingen("een baan in Heemskerk overmorgen om 9 uur").herkend).toBe(false);
    // Ter controle: dit blijft wél gewoon een geldige zoekopdracht.
    expect(parseAdhocZoekopdracht("zoek een baan in Haarlem rond 20:00")).not.toBeNull();
  });
});

describe("parseVastMomentOpdracht", () => {
  it("herkent toevoegen met dag+tijd", () => {
    const r = parseVastMomentOpdracht("zet dinsdag 20:00 als vast moment");
    expect(r).toEqual({ actie: "toevoegen", dagen: [2], tijd: "20:00" });
  });

  it("herkent verwijderen zonder tijd (alle momenten op die dag)", () => {
    const r = parseVastMomentOpdracht("haal dinsdag weg");
    expect(r?.actie).toBe("verwijderen");
    expect(r?.dagen).toEqual([2]);
    expect(r?.tijd).toBeNull();
  });

  it("geeft null zonder vast-moment-signaal, ook als er toevallig een weekdag in staat", () => {
    expect(parseVastMomentOpdracht("zoek dinsdag een baan in Haarlem")).toBeNull();
  });

  it("geeft null zonder weekdag", () => {
    expect(parseVastMomentOpdracht("zet een vast moment om 20:00")).toBeNull();
  });
});
