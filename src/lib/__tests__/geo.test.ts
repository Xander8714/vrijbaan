import { describe, it, expect } from "vitest";
import { parseCentroideLl, afstandKm, afgerondeAfstand, binnenStraal } from "../geo";

// Referentiepunten uit echte PDOK-antwoorden (29 juli 2026), zodat de test
// niet op verzonnen coördinaten leunt.
const HAARLEM = { lat: 52.38242027, lon: 4.64668526 };
const OVERVEEN = { lat: 52.41128935, lon: 4.57574082 };
const VELSERBROEK = { lat: 52.43342646, lon: 4.6633646 };

describe("parseCentroideLl", () => {
  it("leest een PDOK-punt met lon vóór lat", () => {
    expect(parseCentroideLl("POINT(4.61973571 52.38599139)")).toEqual({
      lat: 52.38599139,
      lon: 4.61973571,
    });
  });

  it("verdraagt witruimte rondom", () => {
    expect(parseCentroideLl("  POINT( 4.5 52.5 )  ")).toEqual({ lat: 52.5, lon: 4.5 });
  });

  it("geeft null bij een onverwachte vorm i.p.v. NaN-coördinaten", () => {
    expect(parseCentroideLl("MULTIPOINT(4 52)")).toBeNull();
    expect(parseCentroideLl("")).toBeNull();
    expect(parseCentroideLl(undefined)).toBeNull();
    expect(parseCentroideLl("POINT(abc def)")).toBeNull();
  });
});

describe("afstandKm", () => {
  it("is 0 voor hetzelfde punt", () => {
    expect(afstandKm(HAARLEM, HAARLEM)).toBe(0);
  });

  it("rekent middelpunt-tot-middelpunt Haarlem–Overveen op ~5,8 km", () => {
    // LET OP — dit is bewust NIET het getal dat PDOK teruggeeft. PDOK's
    // reverse-endpoint meldde 1599.57 m voor Overveen vanaf Haarlem, maar dat
    // is de afstand tot de RAND van de woonplaats (Overveen grenst aan
    // Haarlem). Tussen de twee middelpunten zit 5,786 km. Twee verschillende
    // maten dus; verwar ze niet bij het vergelijken van clubs en plaatsen.
    expect(afstandKm(HAARLEM, OVERVEEN)).toBeCloseTo(5.79, 2);
  });

  it("is symmetrisch", () => {
    expect(afstandKm(HAARLEM, VELSERBROEK)).toBeCloseTo(afstandKm(VELSERBROEK, HAARLEM), 10);
  });

  it("rondt af op 1 decimaal", () => {
    expect(afgerondeAfstand(HAARLEM, OVERVEEN)).toBe(5.8);
  });
});

describe("binnenStraal", () => {
  const clubs = [
    { id: "haarlem", ...HAARLEM },
    { id: "overveen", ...OVERVEEN },
    { id: "velserbroek", ...VELSERBROEK },
  ];

  it("filtert weg wat buiten de straal valt", () => {
    // Overveen en Velserbroek liggen beide op ~5,8 km, dus met 3 km blijft
    // alleen het middelpunt zelf over.
    const resultaat = binnenStraal(clubs, HAARLEM, 3);
    expect(resultaat.map((c) => c.id)).toEqual(["haarlem"]);
    expect(resultaat[0].afstandKm).toBe(0);
  });

  it("neemt alles mee bij een ruime straal, kortste eerst", () => {
    const resultaat = binnenStraal(clubs, HAARLEM, 100);
    expect(resultaat).toHaveLength(3);
    expect(resultaat[0].id).toBe("haarlem");
    // Niet op exacte volgorde toetsen bij gelijke afstanden (Overveen en
    // Velserbroek ronden beide op 5,8 km af) — wel dat het oplopend is.
    expect(resultaat[0].afstandKm).toBeLessThanOrEqual(resultaat[1].afstandKm);
    expect(resultaat[1].afstandKm).toBeLessThanOrEqual(resultaat[2].afstandKm);
  });

  it("geeft een lege lijst als niets binnen de straal valt", () => {
    expect(binnenStraal(clubs, { lat: 51.0, lon: 3.0 }, 5)).toEqual([]);
  });
});
