import { describe, expect, it } from "vitest";
import { isRadarOverdrachtData, overdrachtNaarMetingen, type RadarOverdrachtData } from "../radarOverdracht";

const geldig: RadarOverdrachtData = {
  datum: "2026-08-12",
  opgehaaldOp: "2026-08-05T21:10:56.947Z",
  beschikbaarheid: [
    { clubId: "pim-mulier", sloten: [{ tijd: "20:30", prijs: null }] },
  ],
};

describe("Radar-overdracht", () => {
  it("accepteert een geldige kortlevende meting", () => {
    expect(isRadarOverdrachtData(geldig)).toBe(true);
  });

  it("weigert onverwachte of onbegrensde data", () => {
    expect(isRadarOverdrachtData({ ...geldig, datum: "morgen" })).toBe(false);
    expect(isRadarOverdrachtData({ ...geldig, beschikbaarheid: [{ clubId: "x", sloten: "veel" }] })).toBe(false);
  });

  it("maakt de sleutel die de Radar direct kan tonen", () => {
    const metingen = overdrachtNaarMetingen(geldig);
    expect(metingen.get("pim-mulier|2026-08-12")?.sloten).toEqual([{ tijd: "20:30", prijs: null }]);
  });
});
