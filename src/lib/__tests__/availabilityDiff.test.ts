import { describe, it, expect } from "vitest";
import { hashSlots, nieuweSlotenSinds } from "../availabilityDiff";

const slot = (startTime: string) => ({ startTime });

describe("hashSlots", () => {
  it("geeft dezelfde hash voor dezelfde sloten in een andere volgorde", () => {
    const a = hashSlots([slot("19:00"), slot("08:00")]);
    const b = hashSlots([slot("08:00"), slot("19:00")]);
    expect(a).toBe(b);
  });

  it("geeft een andere hash zodra de sloten verschillen", () => {
    const a = hashSlots([slot("08:00")]);
    const b = hashSlots([slot("08:00"), slot("19:00")]);
    expect(a).not.toBe(b);
  });

  it("geeft dezelfde hash voor twee lege lijsten", () => {
    expect(hashSlots([])).toBe(hashSlots([]));
  });
});

describe("nieuweSlotenSinds", () => {
  it("meldt niets bij de eerste meting (vorige = null), ook al zijn er sloten", () => {
    expect(nieuweSlotenSinds(null, [slot("08:00"), slot("19:00")])).toEqual([]);
  });

  it("detecteert een nieuw slot t.o.v. de vorige meting", () => {
    const vorige = [slot("08:00")];
    const nieuwe = [slot("08:00"), slot("19:00")];
    expect(nieuweSlotenSinds(vorige, nieuwe)).toEqual([slot("19:00")]);
  });

  it("meldt niets als er sloten zijn verdwenen (geboekt), alleen bij toevoegingen", () => {
    const vorige = [slot("08:00"), slot("19:00")];
    const nieuwe = [slot("08:00")];
    expect(nieuweSlotenSinds(vorige, nieuwe)).toEqual([]);
  });

  it("geeft een lege lijst als er niets veranderd is", () => {
    const sloten = [slot("08:00"), slot("19:00")];
    expect(nieuweSlotenSinds(sloten, sloten)).toEqual([]);
  });
});
