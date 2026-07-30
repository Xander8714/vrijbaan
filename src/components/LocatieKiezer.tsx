"use client";
import { useState } from "react";
import type { GevondenLocatie } from "@/lib/geo";

/**
 * Zoekveld voor een straat, adres of woonplaats via /api/adres-zoeken (PDOK).
 *
 * De gebruiker kiest altijd zélf uit de gevonden kandidaten. Dat is geen
 * luxe: PDOK matcht fuzzy en geeft bij een niet-bestaand adres stilzwijgend
 * een ander adres terug (zie de val beschreven in src/lib/geo.ts) — dus
 * automatisch het eerste resultaat overnemen zou de gebruiker ongemerkt op een
 * verkeerd punt zetten, waarna de hele straal-berekening scheef staat.
 */
export default function LocatieKiezer({
  onKies,
  beginwaarde = "",
  label = "Straat, plaats of postcode",
}: {
  onKies: (locatie: GevondenLocatie) => void;
  beginwaarde?: string;
  label?: string;
}) {
  const [term, setTerm] = useState(beginwaarde);
  const [resultaten, setResultaten] = useState<GevondenLocatie[] | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const zoek = async () => {
    setFout(null);
    setResultaten(null);
    if (term.trim().length < 2) { setFout("Vul minimaal 2 tekens in."); return; }
    setBezig(true);
    try {
      const res = await fetch(`/api/adres-zoeken?q=${encodeURIComponent(term.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Zoeken mislukt.");
      if (data.resultaten.length === 0) setFout("Niets gevonden — probeer bijvoorbeeld alleen de straatnaam of de woonplaats.");
      setResultaten(data.resultaten);
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Zoeken mislukt.");
    } finally {
      setBezig(false);
    }
  };

  const soortLabel: Record<GevondenLocatie["soort"], string> = {
    adres: "adres",
    weg: "straat",
    woonplaats: "woonplaats",
    overig: "locatie",
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700" htmlFor="locatie-zoek">{label}</label>
      <div className="mt-1 flex gap-2">
        <input
          id="locatie-zoek"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); zoek(); } }}
          placeholder="bv. Zijlweg Haarlem of Velserbroek"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="button" onClick={zoek} disabled={bezig}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {bezig ? "Zoeken…" : "Zoek"}
        </button>
      </div>

      {resultaten && resultaten.length > 0 && (
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
          {resultaten.map((r) => (
            <li key={r.id}>
              <button type="button"
                onClick={() => { onKies(r); setResultaten(null); setTerm(r.weergavenaam); }}
                className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-white">
                {r.weergavenaam} <span className="text-slate-400">({soortLabel[r.soort]})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {fout && <p className="mt-1 text-xs text-red-600">{fout}</p>}
    </div>
  );
}
