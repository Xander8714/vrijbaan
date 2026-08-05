import { describe, expect, it } from "vitest";
import { magDoor, MAX_CLUBS, RATE_LIMIT_MAX_VERZOEKEN, RATE_LIMIT_VENSTER_MS } from "../../app/api/beschikbaarheid/route";

// magDoor deelt één module-brede Map — elke test gebruikt een eigen unieke
// "IP" i.p.v. de Map te resetten, zodat tests elkaar nooit beïnvloeden.
let teller = 0;
const nieuwIp = () => `test-ip-${(teller += 1)}`;

describe("beschikbaarheid-route rate limiting (5 aug 2026, security-assessment)", () => {
  it("beperkt één live aanvraag tot één browserbatch", () => {
    expect(MAX_CLUBS).toBe(4);
  });

  it("laat verzoeken door tot aan de limiet", () => {
    const ip = nieuwIp();
    const nu = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_VERZOEKEN; i += 1) {
      expect(magDoor(ip, nu)).toBe(true);
    }
  });

  it("weigert het verzoek zodra de limiet binnen hetzelfde venster is bereikt", () => {
    const ip = nieuwIp();
    const nu = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_VERZOEKEN; i += 1) magDoor(ip, nu);
    expect(magDoor(ip, nu)).toBe(false);
  });

  it("hindert twee verschillende IP's niet van elkaar (geen gedeelde teller)", () => {
    const ipA = nieuwIp();
    const ipB = nieuwIp();
    const nu = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_VERZOEKEN; i += 1) magDoor(ipA, nu);
    expect(magDoor(ipA, nu)).toBe(false); // A zit vol...
    expect(magDoor(ipB, nu)).toBe(true); // ...maar B is volledig ongemoeid
  });

  it("staat weer verzoeken toe zodra het venster verstreken is", () => {
    const ip = nieuwIp();
    const nu = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_VERZOEKEN; i += 1) magDoor(ip, nu);
    expect(magDoor(ip, nu)).toBe(false);
    expect(magDoor(ip, nu + RATE_LIMIT_VENSTER_MS)).toBe(true);
  });
});
