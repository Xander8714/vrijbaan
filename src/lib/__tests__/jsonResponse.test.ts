import { describe, expect, it } from "vitest";
import { leesJsonRespons } from "../jsonResponse";

describe("leesJsonRespons", () => {
  it("geeft geldige JSON terug", async () => {
    const response = Response.json({ beschikbaarheid: [] });
    await expect(leesJsonRespons<{ beschikbaarheid: unknown[] }>(response)).resolves.toEqual({ beschikbaarheid: [] });
  });

  it("vertaalt een nginx-504 naar een begrijpelijke fout zonder JSON-parsermelding", async () => {
    const response = new Response("<html><h1>504 Gateway Time-out</h1></html>", {
      status: 504,
      headers: { "Content-Type": "text/html" },
    });
    await expect(leesJsonRespons(response)).rejects.toThrow("duurde te lang");
  });

  it("gebruikt de fouttekst uit een JSON-foutrespons", async () => {
    const response = Response.json({ error: "Maak je selectie kleiner." }, { status: 413 });
    await expect(leesJsonRespons(response)).rejects.toThrow("Maak je selectie kleiner.");
  });
});
