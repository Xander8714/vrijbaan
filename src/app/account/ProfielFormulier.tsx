"use client";
import { useMemo, useState } from "react";
import LocatieKiezer from "@/components/LocatieKiezer";
import { afgerondeAfstand, type GevondenLocatie } from "@/lib/geo";
import type { Profiel } from "@/lib/types";
import { LEDEN_CLUBS } from "@/lib/clubs";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Eigen gegevens bekijken en bijwerken. De locatie wordt niet als losse
 * tekstregel bewaard maar samen met lat/lon uit PDOK, want daar rekent de
 * Radar-straal op — een woonplaats zonder coördinaat is voor het filteren
 * onbruikbaar.
 */
export default function ProfielFormulier({
  userId,
  beginProfiel,
}: {
  userId: string;
  beginProfiel: Profiel;
}) {
  const [profiel, setProfiel] = useState<Profiel>(beginProfiel);
  const [status, setStatus] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [eigenVereniging, setEigenVereniging] = useState("");

  /**
   * De keuzelijst met ledenclubs staat bewust ná de woonplaats: zodra we een
   * middelpunt hebben, sorteren we op afstand en tonen we alleen clubs binnen
   * 50 km. Dat houdt de lijst kort en relevant in plaats van een landelijke
   * opsomming. Staat er geen locatie, dan gewoon alles op alfabet.
   */
  const ledenClubKeuzes = useMemo(() => {
    if (profiel.lat === null || profiel.lon === null) {
      return LEDEN_CLUBS.map((c) => ({ ...c, afstandKm: null as number | null })).sort((a, b) =>
        a.naam.localeCompare(b.naam, "nl")
      );
    }
    const vanaf = { lat: profiel.lat, lon: profiel.lon };
    return LEDEN_CLUBS.map((c) => ({ ...c, afstandKm: afgerondeAfstand(vanaf, c) }))
      .filter((c) => (c.afstandKm ?? 0) <= 50)
      .sort((a, b) => (a.afstandKm ?? 0) - (b.afstandKm ?? 0));
  }, [profiel.lat, profiel.lon]);

  const voegLidmaatschapToe = (waarde: string) => {
    const schoon = waarde.trim();
    if (!schoon || profiel.lidmaatschappen.includes(schoon)) return;
    setProfiel((p) => ({ ...p, lidmaatschappen: [...p.lidmaatschappen, schoon] }));
  };

  const verwijderLidmaatschap = (waarde: string) =>
    setProfiel((p) => ({ ...p, lidmaatschappen: p.lidmaatschappen.filter((l) => l !== waarde) }));

  // Een lidmaatschap kan een club-id zijn of een zelf getypte naam.
  const lidmaatschapLabel = (waarde: string) =>
    LEDEN_CLUBS.find((c) => c.id === waarde)?.naam ?? waarde;

  const zet = <K extends keyof Profiel>(veld: K, waarde: Profiel[K]) =>
    setProfiel((p) => ({ ...p, [veld]: waarde }));

  const kiesLocatie = (loc: GevondenLocatie) => {
    setProfiel((p) => ({
      ...p,
      straat: loc.straatnaam ?? (loc.soort === "weg" ? loc.weergavenaam.split(",")[0] : p.straat),
      postcode: loc.postcode ?? p.postcode,
      woonplaats: loc.woonplaatsnaam ?? p.woonplaats,
      lat: loc.lat,
      lon: loc.lon,
    }));
    setStatus("Locatie gekozen — klik op Opslaan om te bewaren.");
  };

  const opslaan = async () => {
    setFout(null); setStatus(null); setBezig(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase
      .from("profiles")
      .update({
        voornaam: profiel.voornaam,
        achternaam: profiel.achternaam,
        speelsterkte: profiel.speelsterkte,
        // Handmatig invullen overschrijft een eerdere KNLTB-herkomst; dat moet
        // zichtbaar blijven, anders lijkt een zelf getypt getal officieel.
        speelsterkte_bron: profiel.speelsterkte === null ? null : "handmatig",
        bondsnummer: profiel.bondsnummer,
        straat: profiel.straat,
        huisnummer: profiel.huisnummer,
        postcode: profiel.postcode,
        woonplaats: profiel.woonplaats,
        lat: profiel.lat,
        lon: profiel.lon,
        zoekstraal_km: profiel.zoekstraalKm,
        lidmaatschappen: profiel.lidmaatschappen,
      })
      .eq("id", userId);
    setBezig(false);
    if (error) {
      // Ontbrekende kolommen = migratie nog niet gedraaid. Noem het bestand,
      // anders zoekt iemand een bug die er niet is.
      const kolomOntbreekt = /column|schema cache/i.test(error.message);
      setFout(
        kolomOntbreekt
          ? "De database mist nog de nieuwe profielkolommen. Voer supabase/migraties/2026-07-29-profielgegevens-en-clubaanmeldingen.sql uit in de Supabase SQL editor."
          : `Opslaan mislukt: ${error.message}`
      );
      return;
    }
    setStatus("Gegevens opgeslagen ✓");
  };

  const tekstveld = (
    label: string,
    veld: "voornaam" | "achternaam" | "straat" | "huisnummer" | "postcode" | "woonplaats" | "bondsnummer",
    placeholder = ""
  ) => (
    <div>
      <label className="block text-sm font-medium text-slate-700" htmlFor={`veld-${veld}`}>{label}</label>
      <input
        id={`veld-${veld}`}
        value={profiel[veld] ?? ""}
        onChange={(e) => zet(veld, e.target.value === "" ? null : e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Mijn gegevens</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {tekstveld("Voornaam", "voornaam")}
          {tekstveld("Achternaam", "achternaam")}
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="veld-speelsterkte">
              Speelsterkte (1 = sterkst, 9 = beginner)
            </label>
            <input
              id="veld-speelsterkte"
              type="number" step="0.1" min="1" max="9"
              value={profiel.speelsterkte ?? ""}
              onChange={(e) => zet("speelsterkte", e.target.value === "" ? null : Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            {profiel.speelsterkteBron && (
              <p className="mt-1 text-xs text-slate-500">
                Huidige bron: {profiel.speelsterkteBron === "knltb" ? "opgehaald bij de KNLTB" : "zelf ingevuld"}
              </p>
            )}
          </div>
          {tekstveld("KNLTB-bondsnummer", "bondsnummer", "optioneel")}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Waar zoek je banen?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Kies je straat of woonplaats. De Radar toont dan alleen clubs binnen je straal — ook in dorpen om je heen.
        </p>
        <div className="mt-3">
          <LocatieKiezer onKies={kiesLocatie} beginwaarde={profiel.woonplaats ?? ""} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {tekstveld("Straat", "straat")}
          {tekstveld("Huisnummer", "huisnummer")}
          {tekstveld("Postcode", "postcode")}
          {tekstveld("Woonplaats", "woonplaats")}
        </div>
        {/* Lidmaatschappen: direct na de woonplaats, zodat de keuzelijst op
            afstand gesorteerd en kort kan zijn. */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="veld-ledenclub">
            Ben je lid van een vereniging?
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Bij verenigingen kun je alleen als lid boeken, dus die verbergen we normaal. Geef je aan dat je er lid
            bent, dan tonen we hun vrije banen wél — met een link naar de clubsite.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <select
              id="veld-ledenclub"
              defaultValue=""
              onChange={(e) => { voegLidmaatschapToe(e.target.value); e.currentTarget.value = ""; }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— kies een vereniging —</option>
              {ledenClubKeuzes.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.naam}{club.afstandKm !== null ? ` (${club.afstandKm} km)` : ""}
                </option>
              ))}
            </select>
            <input
              value={eigenVereniging}
              onChange={(e) => setEigenVereniging(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); voegLidmaatschapToe(eigenVereniging); setEigenVereniging(""); }
              }}
              placeholder="Of typ je verenigingsnaam"
              aria-label="Verenigingsnaam zelf invullen"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="button"
              onClick={() => { voegLidmaatschapToe(eigenVereniging); setEigenVereniging(""); }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Toevoegen
            </button>
          </div>
          {ledenClubKeuzes.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Geen verenigingen bekend binnen 50 km — typ de naam dan zelf.
            </p>
          )}
          {profiel.lidmaatschappen.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {profiel.lidmaatschappen.map((l) => (
                <li key={l} className="flex items-center gap-2 rounded-md bg-court-50 px-2 py-1 text-xs text-court-800">
                  {lidmaatschapLabel(l)}
                  <button type="button" onClick={() => verwijderLidmaatschap(l)}
                    aria-label={`Verwijder ${lidmaatschapLabel(l)}`} className="text-court-600 hover:text-red-600">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="veld-straal">
            Zoekstraal: {profiel.zoekstraalKm} km
          </label>
          <input
            id="veld-straal"
            type="range" min="1" max="100" step="1"
            value={profiel.zoekstraalKm}
            onChange={(e) => zet("zoekstraalKm", Number(e.target.value))}
            className="mt-2 w-full"
          />
        </div>
        {profiel.lat !== null && profiel.lon !== null ? (
          <p className="mt-2 text-xs text-court-700">
            Middelpunt bekend ({profiel.lat.toFixed(5)}, {profiel.lon.toFixed(5)}) — de straal-filter werkt.
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-700">
            Nog geen middelpunt gekozen. Zoek hierboven een straat of woonplaats, anders kan de Radar niet op afstand filteren.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={opslaan} disabled={bezig}
          className="rounded-md bg-court-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-court-700 disabled:opacity-50">
          {bezig ? "Opslaan…" : "Opslaan"}
        </button>
        {status && <span className="text-sm text-court-700">{status}</span>}
        {fout && <span className="text-sm text-red-600">{fout}</span>}
      </div>
    </div>
  );
}
