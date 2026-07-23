"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Player } from "@/lib/types";
import { besteOpstelling, OpstellingResultaat } from "@/lib/lineup";
import { supabaseBrowser } from "@/lib/supabase/client";

let idTeller = 0;
function nieuwId() { idTeller += 1; return `speler-${idTeller}`; }

function SpelerLijst({ titel, spelers, setSpelers }: { titel: string; spelers: Player[]; setSpelers: (s: Player[]) => void; }) {
  const [naam, setNaam] = useState("");
  const [sterkte, setSterkte] = useState(6);
  const [fout, setFout] = useState<string | null>(null);
  const voegToe = () => {
    if (!naam.trim()) { setFout("Vul eerst een naam in."); return; }
    setFout(null);
    setSpelers([...spelers, { id: nieuwId(), naam: naam.trim(), speelsterkte: sterkte }]);
    setNaam("");
  };
  const verwijder = (id: string) => setSpelers(spelers.filter((s) => s.id !== id));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{titel}</h2>
        <a href="https://mijn.knltb.nl" target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline">Speelsterkte opzoeken →</a>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`naam-${titel}`}>Naam speler</label>
        <input id={`naam-${titel}`} value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Naam speler" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <label className="sr-only" htmlFor={`sterkte-${titel}`}>Speelsterkte</label>
        <select id={`sterkte-${titel}`} value={sterkte} onChange={(e) => setSterkte(Number(e.target.value))} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
          {[1,2,3,4,5,6,7,8,9].map((n) => (<option key={n} value={n}>Speelsterkte {n} {n===1?"(sterkst)":n===9?"(beginner)":""}</option>))}
        </select>
        <button onClick={voegToe} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Toevoegen</button>
      </div>
      {fout && <p className="mt-1 text-xs text-red-600">{fout}</p>}
      <ul className="mt-3 space-y-1">
        {spelers.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm">
            <span>{s.naam} — speelsterkte {s.speelsterkte}</span>
            <button onClick={() => verwijder(s.id)} className="text-slate-400 hover:text-red-600" aria-label={`Verwijder ${s.naam}`}>✕</button>
          </li>
        ))}
        {spelers.length === 0 && <li className="text-sm text-slate-400">Nog geen spelers toegevoegd.</li>}
      </ul>
    </div>
  );
}

export default function OpstellingPage() {
  const [eigenSpelers, setEigenSpelers] = useState<Player[]>([]);
  const [tegenSpelers, setTegenSpelers] = useState<Player[]>([]);
  const [resultaat, setResultaat] = useState<OpstellingResultaat | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [opslagStatus, setOpslagStatus] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data: teams } = await supabase.from("teams").select("id, naam").eq("user_id", user.id).limit(1);
      if (teams && teams.length > 0) {
        setTeamId(teams[0].id);
        const { data: spelers } = await supabase.from("team_spelers").select("id, naam, speelsterkte").eq("team_id", teams[0].id);
        if (spelers) setEigenSpelers(spelers.map((s) => ({ id: s.id, naam: s.naam, speelsterkte: s.speelsterkte })));
      }
    });
  }, []);

  const bewaarTeam = async () => {
    if (!userId) { setOpslagStatus("Log in om je team te bewaren."); return; }
    const supabase = supabaseBrowser();
    let huidigTeamId = teamId;
    if (!huidigTeamId) {
      const { data, error } = await supabase.from("teams").insert({ user_id: userId, naam: "Mijn team" }).select("id").single();
      if (error || !data) { setOpslagStatus("Opslaan mislukt."); return; }
      huidigTeamId = data.id;
      setTeamId(huidigTeamId);
    } else {
      await supabase.from("team_spelers").delete().eq("team_id", huidigTeamId);
    }
    await supabase.from("team_spelers").insert(eigenSpelers.map((s) => ({ team_id: huidigTeamId, naam: s.naam, speelsterkte: s.speelsterkte })));
    setOpslagStatus("Team opgeslagen ✓");
  };

  const bereken = () => {
    setFout(null); setResultaat(null);
    if (eigenSpelers.length < 2 || eigenSpelers.length % 2 !== 0) { setFout("Voeg een even aantal spelers toe (bv. 4, 6 of 8) om koppels te vormen."); return; }
    if (tegenSpelers.length > 0 && tegenSpelers.length !== eigenSpelers.length) { setFout("Als je tegenstanders invoert, moet dit hetzelfde aantal spelers zijn."); return; }
    try { setResultaat(besteOpstelling(eigenSpelers, tegenSpelers.length > 0 ? tegenSpelers : undefined)); }
    catch (e) { setFout(e instanceof Error ? e.message : "Onbekende fout"); }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-emerald-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Opstelling Optimizer</h1>
      <p className="mt-2 text-slate-600">Vul je beschikbare spelers in met hun KNLTB-speelsterkte. Voeg optioneel de tegenstander toe voor een verwachte winkans per wedstrijd.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <SpelerLijst titel="Eigen team" spelers={eigenSpelers} setSpelers={setEigenSpelers} />
        <SpelerLijst titel="Tegenstander (optioneel)" spelers={tegenSpelers} setSpelers={setTegenSpelers} />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={bereken} className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700">Bereken beste opstelling</button>
        <button onClick={bewaarTeam} className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Team opslaan</button>
        {opslagStatus && <span className="text-xs text-slate-500">{opslagStatus}</span>}
      </div>
      {fout && <p className="mt-4 text-sm text-red-600">{fout}</p>}
      {resultaat && (
        <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="font-semibold text-emerald-900">Aanbevolen opstelling</h2>
          <ol className="mt-3 space-y-2">
            {resultaat.perWedstrijd.map((w, i) => (
              <li key={i} className="rounded-md bg-white px-3 py-2 text-sm shadow-sm">
                <span className="font-medium">Wedstrijd {i + 1}: </span>
                {w.eigen.spelers[0].naam} &amp; {w.eigen.spelers[1].naam} <span className="text-slate-500">(gem. {w.eigen.gemSterkte.toFixed(1)})</span>
                {w.tegen && (<>{" "}vs {w.tegen.spelers[0].naam} &amp; {w.tegen.spelers[1].naam} <span className="text-slate-500">(gem. {w.tegen.gemSterkte.toFixed(1)})</span></>)}
                {w.winkans !== undefined && (<span className="ml-2 font-semibold text-emerald-700">{Math.round(w.winkans * 100)}% winkans</span>)}
              </li>
            ))}
          </ol>
          {tegenSpelers.length > 0 && (<p className="mt-3 text-sm text-emerald-800">Gemiddelde verwachte winkans: <strong>{Math.round(resultaat.verwachtWinpercentage * 100)}%</strong></p>)}
        </div>
      )}
    </main>
  );
}
