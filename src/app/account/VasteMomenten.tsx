"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { rondAfOpHalfUur } from "@/lib/tijd";
import type { VastSpeelmoment } from "@/lib/types";

// JS Date#getDay()-conventie (0=zondag), zelfde als vaste_speelmomenten.dag.
// Weergave begint bij maandag, want dat leest natuurlijker in het
// Nederlands, ook al is de opgeslagen waarde anders.
const WEEKDAGEN: { waarde: number; label: string }[] = [
  { waarde: 1, label: "Maandag" },
  { waarde: 2, label: "Dinsdag" },
  { waarde: 3, label: "Woensdag" },
  { waarde: 4, label: "Donderdag" },
  { waarde: 5, label: "Vrijdag" },
  { waarde: 6, label: "Zaterdag" },
  { waarde: 0, label: "Zondag" },
];

// Lokale werkkopie van een moment: id is null zolang het nog niet is
// opgeslagen (net toegevoegd via "+ Voeg nog een moment toe").
type Rij = { id: string | null; dag: number | null; tijd: string | null; gemeld: boolean };

let volgendTijdelijkId = 0;

function naarRijen(momenten: VastSpeelmoment[]): (Rij & { sleutel: string })[] {
  return momenten.map((m) => ({ id: m.id, dag: m.dag, tijd: m.tijd, gemeld: m.gemeld, sleutel: m.id }));
}

/**
 * Meerdere vaste speelmomenten (dag + tijd), elk met een eigen aan/uit-
 * vinkje voor de wekelijkse herinnering — Xander (3 aug 2026): "zorg dat ik
 * meer vaste momenten kan kiezen met iets als voeg er nog 1 toe" + "vinkje
 * erachter van wil je op de hoogte gehouden worden van deze tijden". Elk
 * moment staat los in tabel vaste_speelmomenten (zie de migratie van 3 aug
 * 2026) i.p.v. de eerdere, losse profiles.terugkerende_dag die maar één
 * moment toeliet. scripts/poll-availability.ts checkt per moment met
 * gemeld=true, 90 min na de tijd, of diezelfde dag/tijd volgende week nog
 * vrij is.
 *
 * Toont daarnaast (Xander: "daar ook nogmaals de favorieten tonen van
 * clubs") de gevolgde clubs erbij — puur ter referentie, wijzigen daarvan
 * blijft op de Radar-pagina gebeuren, dat is al de plek met de "Volg deze
 * club"-knoppen.
 */
export default function VasteMomenten({
  userId,
  beginMomenten,
  favorieteClubs,
}: {
  userId: string;
  beginMomenten: VastSpeelmoment[];
  favorieteClubs: { id: string; naam: string; plaats: string }[];
}) {
  const [rijen, setRijen] = useState<(Rij & { sleutel: string })[]>(() => naarRijen(beginMomenten));
  const [verwijderdIds, setVerwijderdIds] = useState<string[]>([]);
  const [bezig, setBezig] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const voegToe = () => {
    volgendTijdelijkId += 1;
    setRijen((r) => [...r, { id: null, dag: null, tijd: null, gemeld: true, sleutel: `nieuw-${volgendTijdelijkId}` }]);
    setStatus(null);
  };

  const werkBij = (sleutel: string, veld: keyof Rij, waarde: Rij[keyof Rij]) => {
    setRijen((r) => r.map((rij) => (rij.sleutel === sleutel ? { ...rij, [veld]: waarde } : rij)));
    setStatus(null);
  };

  const verwijder = (sleutel: string) => {
    setRijen((r) => {
      const rij = r.find((x) => x.sleutel === sleutel);
      if (rij?.id) setVerwijderdIds((v) => [...v, rij.id!]);
      return r.filter((x) => x.sleutel !== sleutel);
    });
    setStatus(null);
  };

  const opslaan = async () => {
    setBezig(true);
    setFout(null);
    setStatus(null);
    const supabase = supabaseBrowser();

    if (verwijderdIds.length > 0) {
      const { error } = await supabase.from("vaste_speelmomenten").delete().in("id", verwijderdIds);
      if (error) { setFout(`Verwijderen mislukt: ${error.message}`); setBezig(false); return; }
    }

    // Onvolledige rijen (nog geen dag/tijd gekozen) stilzwijgend overslaan —
    // die is de gebruiker duidelijk nog aan het invullen.
    const volledig = rijen.filter((r) => r.dag !== null && r.tijd);
    const nieuweIds = new Map<string, string>();
    for (const r of volledig) {
      if (r.id) {
        const { error } = await supabase
          .from("vaste_speelmomenten")
          .update({ dag: r.dag, tijd: r.tijd, gemeld: r.gemeld })
          .eq("id", r.id);
        if (error) { setFout(`Opslaan mislukt: ${error.message}`); setBezig(false); return; }
      } else {
        const { data, error } = await supabase
          .from("vaste_speelmomenten")
          .insert({ profile_id: userId, dag: r.dag, tijd: r.tijd, gemeld: r.gemeld })
          .select("id")
          .single();
        if (error) {
          const kolomOntbreekt = /relation|column|schema cache/i.test(error.message);
          setFout(
            kolomOntbreekt
              ? "De database mist de tabel vaste_speelmomenten nog. Voer supabase/migraties/2026-08-03-vaste-speelmomenten.sql uit in de Supabase SQL editor."
              : `Opslaan mislukt: ${error.message}`
          );
          setBezig(false);
          return;
        }
        if (data) nieuweIds.set(r.sleutel, data.id as string);
      }
    }

    // Nieuw toegekende id's terugzetten zodat een volgende "Opslaan" een
    // update wordt in plaats van nogmaals in te voegen.
    setRijen((huidig) => huidig.map((r) => (nieuweIds.has(r.sleutel) ? { ...r, id: nieuweIds.get(r.sleutel)! } : r)));
    setVerwijderdIds([]);
    setBezig(false);
    setStatus("Opgeslagen ✓");
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">Vaste speelmomenten</h2>
      <p className="mt-1 text-sm text-slate-600">
        Speel je op vaste dagen en tijden? Voeg ze hier toe. Voor elk moment met het vinkje aan checken we ruim erna
        automatisch of datzelfde moment volgende week ook vrij is, en sturen we je via Telegram een berichtje met een
        link. Vereist een gekoppelde Telegram-chat en een locatie (hierboven).
      </p>

      <div className="mt-3 space-y-2">
        {rijen.map((r) => (
          <div key={r.sleutel} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-2">
            <select
              aria-label="Speeldag"
              value={r.dag ?? ""}
              onChange={(e) => werkBij(r.sleutel, "dag", e.target.value === "" ? null : Number(e.target.value))}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Kies een dag</option>
              {WEEKDAGEN.map((d) => (
                <option key={d.waarde} value={d.waarde}>{d.label}</option>
              ))}
            </select>
            <input
              aria-label="Speeltijd"
              type="time" step="1800"
              value={r.tijd ?? ""}
              onChange={(e) => werkBij(r.sleutel, "tijd", e.target.value === "" ? null : rondAfOpHalfUur(e.target.value))}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={r.gemeld}
                onChange={(e) => werkBij(r.sleutel, "gemeld", e.target.checked)}
              />
              Op de hoogte houden van deze tijd
            </label>
            <button
              type="button"
              onClick={() => verwijder(r.sleutel)}
              aria-label="Moment verwijderen"
              className="ml-auto text-sm text-slate-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        {rijen.length === 0 && <p className="text-sm text-slate-500">Nog geen vaste momenten toegevoegd.</p>}
      </div>

      <button
        type="button"
        onClick={voegToe}
        className="mt-3 rounded-md border border-court-300 bg-court-50 px-3 py-1.5 text-sm font-medium text-court-800 hover:bg-court-100"
      >
        + Voeg nog een moment toe
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <button
          onClick={opslaan}
          disabled={bezig}
          className="rounded-md bg-court-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-court-700 disabled:opacity-50"
        >
          {bezig ? "Opslaan…" : "Opslaan"}
        </button>
        {status && <span className="text-sm text-court-700">{status}</span>}
        {fout && <span className="text-sm text-red-600">{fout}</span>}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-medium text-slate-700">Je gevolgde clubs</h3>
        {favorieteClubs.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {favorieteClubs.map((c) => (
              <li key={c.id} className="rounded-md bg-court-50 px-2 py-1 text-xs text-court-800">
                {c.naam} <span className="text-court-500">· {c.plaats}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Nog geen clubs gevolgd.</p>
        )}
        <Link href="/radar" className="mt-2 inline-block text-xs font-medium text-court-700 hover:underline">
          Beheer je gevolgde clubs op de Radar →
        </Link>
      </div>
    </section>
  );
}
