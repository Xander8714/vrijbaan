"use client";
import { useEffect, useRef, useState } from "react";
import type { GevondenLocatie } from "@/lib/geo";

// Wachttijd na de laatste toetsaanslag vóór we zoeken — kort genoeg om als
// "live" te voelen, lang genoeg om niet bij elke toets een PDOK-aanvraag te
// versturen terwijl iemand nog aan het typen is.
const ZOEK_VERTRAGING_MS = 300;

/**
 * Zoekveld voor een straat, adres of woonplaats via /api/adres-zoeken (PDOK).
 *
 * Zoekt automatisch mee terwijl je typt (gedebounced) — Xander (30 juli
 * 2026): "als ik begin te typen dat het zoekgebied al met suggesties komt
 * ipv zoeken als ik klaar ben". De knop/Enter blijven werken als directe
 * trigger (bv. voor toetsenbordgebruikers die niet op suggesties willen
 * wachten), maar zijn niet meer nodig voor het gewone geval.
 *
 * De gebruiker kiest nog steeds altijd zélf uit de gevonden kandidaten. Dat
 * is geen luxe: PDOK matcht fuzzy en geeft bij een niet-bestaand adres
 * stilzwijgend een ander adres terug (zie de val beschreven in
 * src/lib/geo.ts) — dus automatisch het eerste resultaat overnemen zou de
 * gebruiker ongemerkt op een verkeerd punt zetten, waarna de hele
 * straal-berekening scheef staat.
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
  // Voorkomt dat een trage, oudere aanvraag een snellere, nieuwere overschrijft
  // (bv. bij "Haarl" nog antwoord krijgen ná "Haarlem" al beantwoord is).
  const laatsteAanvraag = useRef(0);

  const zoek = async (opgegevenTerm?: string) => {
    const huidigeTerm = (opgegevenTerm ?? term).trim();
    const aanvraagId = ++laatsteAanvraag.current;
    setFout(null);
    if (huidigeTerm.length < 2) { setResultaten(null); return; }
    setBezig(true);
    try {
      const res = await fetch(`/api/adres-zoeken?q=${encodeURIComponent(huidigeTerm)}`);
      const data = await res.json();
      if (aanvraagId !== laatsteAanvraag.current) return; // ingehaald door een nieuwere zoekopdracht
      if (!res.ok) throw new Error(data.error ?? "Zoeken mislukt.");
      if (data.resultaten.length === 0) setFout("Niets gevonden — probeer bijvoorbeeld alleen de straatnaam of de woonplaats.");
      setResultaten(data.resultaten);
    } catch (e) {
      if (aanvraagId === laatsteAanvraag.current) setFout(e instanceof Error ? e.message : "Zoeken mislukt.");
    } finally {
      if (aanvraagId === laatsteAanvraag.current) setBezig(false);
    }
  };

  // Alleen zoeken als de gebruiker ook echt heeft GETYPT — niet bij de
  // beginwaarde (een al opgeslagen woonplaats) en niet na het kiezen van een
  // suggestie (die zet `term` ook, maar moet de lijst juist laten sluiten).
  //
  // Bewust GEEN "sla de eerste render over"-vlag die na één keer voorgoed
  // omklapt: React's StrictMode (dev-only) roept een mount-effect twee keer
  // aan om precies dit soort niet-idempotente code te ontdekken — de vlag
  // stond na de eerste (overgeslagen) run al om, dus de tweede run zocht
  // alsnog. Bevestigd doordat Xander het zag gebeuren terwijl mijn eigen
  // test — die te snel las, vóór de tweede/late run klaar was — niets zag
  // (31 juli 2026). Deze `gebruikerTypt`-ref wordt UITSLUITEND in de
  // onChange-handler op true gezet, die draait nooit tijdens een
  // mount-effect, dus is hoe vaak het effect ook loopt altijd consistent.
  const gebruikerTypt = useRef(false);
  useEffect(() => {
    if (!gebruikerTypt.current) return;
    // setState-aanroepen staan bewust NIET rechtstreeks in het effect-lichaam
    // (react-hooks/set-state-in-effect) — via setTimeout(…, 0) i.p.v.
    // synchroon, zelfde patroon als elders in de app (zie radar/page.tsx).
    if (term.trim().length < 2) {
      const t = setTimeout(() => { setResultaten(null); setFout(null); }, 0);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(() => zoek(term), ZOEK_VERTRAGING_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

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
          onChange={(e) => { gebruikerTypt.current = true; setTerm(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); zoek(); } }}
          placeholder="bv. Zijlweg Haarlem of Velserbroek"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => zoek()} disabled={bezig}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {bezig ? "Zoeken…" : "Zoek"}
        </button>
      </div>

      {resultaten && resultaten.length > 0 && (
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
          {resultaten.map((r) => (
            <li key={r.id}>
              <button type="button"
                onClick={() => {
                  onKies(r);
                  setResultaten(null);
                  // Niet via de onChange-handler, dus gebruikerTypt blijft
                  // false — het effect hierboven negeert deze wijziging.
                  gebruikerTypt.current = false;
                  setTerm(r.weergavenaam);
                }}
                className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-white">
                {r.weergavenaam} <span className="text-slate-400">({soortLabel[r.soort]})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {bezig && <p className="mt-1 text-xs text-slate-400">Zoeken…</p>}
      {fout && <p className="mt-1 text-xs text-red-600">{fout}</p>}
    </div>
  );
}
