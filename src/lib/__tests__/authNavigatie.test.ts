import { describe, expect, it } from "vitest";
import { veiligInternPad } from "../authNavigatie";

describe("veiligInternPad", () => {
  it("bewaart een intern pad met querystring", () => {
    expect(veiligInternPad("/radar?datum=2026-08-06&lat=52.3")).toBe(
      "/radar?datum=2026-08-06&lat=52.3"
    );
  });

  it.each([null, "", "https://kwaad.example", "//kwaad.example/pad"])(
    "weigert een onveilige bestemming: %s",
    (pad) => expect(veiligInternPad(pad)).toBe("/radar")
  );

  it("ondersteunt een andere terugval", () => {
    expect(veiligInternPad("javascript:alert(1)", "/")).toBe("/");
  });
});
