"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CLUBS } from "@/lib/clubs";
import { POLL_CONFIG } from "@/lib/pollConfig";
import { supabaseBrowser } from "@/lib/supabase/client";

const GRATIS_LIMIET = 1;

type Beschikbaarheid = { slots: { startTime: string }[]; bijgewerktOp: string };

export default function RadarPage() {
  const [gevolgd, setGevolgd] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [laden, setLaden] = useState(true);
  const [limietMelding, setLimietMelding] = useState(false);
  const [beschikbaarheid, setBeschikbaarheid] = useState<Map<string, Beschikbaarheid>>(new Map());

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLaden(false); return; }
      setUserId(user.id);
      const [{ data: clubs }, { data: profiel }] = await Promise.all([
        supabase.from("gevolgde_clubs").select("club_id").eq("user_id", user.id),
        supabase.from("profiles").select("subscription_status").eq("id", user.id).single(),
      ]);
      setGevolgd(new Set((clubs ?? []).map((r) => r.club_id)));
      setIsPro(profiel?.subscription_status === "pro");
      setLaden(false);
    }).catch(() => setLaden(false));
  }, []);

  useEffect(() => {
    const laadBeschikbaarheid = async () => {
      try {
        const supabase = supabaseBrowser();
        const vandaag = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
          .from("club_beschikbaarheid")
          .select("club_id, slots, bijgewerkt_op")
          .eq("datum", vandaag);
        const map = new Map<string, Beschikbaarheid>();
        (data ?? []).forEach((row) => map.set(row.club_id, { slots: row.slots, bijgewerktOp: row.bijgewerkt_op }));
        setBeschikbaarheid(map);
      } catch {
        // radar blijft bruikbaar met de statische status-tekst als dit faalt
      }
    };
    laadBeschikbaarheid();
  }, []);

  const toggle = async (id: string) => {
    const volgtAl = gevolgd.has(id);
    if (!volgtAl && !isPro && gevolgd.size >= GRATIS_LIMIET) { setLimietMelding(true); return; }
    setLimietMelding(false);
    setGevolgd((prev) => { const next = new Set(prev); if (volgtAl) next.delete(id); else next.add(id); return next; });
    if (!userId) return;
    const supabase = supabaseBrowser();
    if (volgtAl) await supabase.from("gevolgde_clubs").delete().eq("user_id", userId).eq("club_id", id);
    else await supabase.from("gevolgde_clubs").insert({ user_id: userId, club_id: id });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-emerald-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Beschikbaarheid Radar</h1>
      <p className="mt-2 text-slate-600">Volg clubs in Haarlem + 5 km. Zodra dit gekoppeld is aan Playtomic en KNLTB Meet &amp; Play, krijg je hier een melding zodra er een baan vrijkomt.</p>
      {!userId && !laden && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Je bent niet ingelogd — je keuzes worden nu niet bewaard. <Link href="/login" className="font-medium underline">Log in</Link> om ze op te slaan.
        </p>
      )}
      {userId && !isPro && (
        <p className="mt-4 rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-600">
          Gratis account: je kunt {GRATIS_LIMIET} club volgen ({gevolgd.size}/{GRATIS_LIMIET} gebruikt). <Link href="/pricing" className="font-medium text-emerald-700 underline">Upgrade naar Pro</Link> voor alle 8 clubs.
        </p>
      )}
      {limietMelding && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          Je hebt je gratis limiet van {GRATIS_LIMIET} club bereikt. <Link href="/pricing" className="font-medium underline">Upgrade naar Pro</Link>.
        </p>
      )}
      <div className="mt-8 space-y-3">
        {CLUBS.map((club) => {
          const isGevolgd = gevolgd.has(club.id);
          const live = beschikbaarheid.get(club.id);
          const wordtGepolled = club.id in POLL_CONFIG;
          return (
            <div key={club.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold text-slate-900">{club.naam}</p>
                <p className="text-sm text-slate-500">{club.plaats} · {club.banen} banen · {club.systeem}</p>
                {live ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    {live.slots.length > 0
                      ? `${live.slots.length} vrije sloten vandaag`
                      : "Geen vrije sloten meer vandaag"}
                    {" · bijgewerkt "}
                    {new Date(live.bijgewerktOp).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">
                    {club.status}
                    {wordtGepolled ? " · nog geen meting binnen" : " · nog niet gekoppeld"}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <button onClick={() => toggle(club.id)} className={`rounded-md px-4 py-2 text-sm font-medium transition ${isGevolgd ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  {isGevolgd ? "Wordt gevolgd ✓" : "Volg deze club"}
                </button>
                {club.boekingsUrl && (
                  <a href={club.boekingsUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-emerald-700 underline">
                    Boek hier →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-xs text-slate-400">Live beschikbaarheid staat aan voor Hofgeest (Meet &amp; Play), WePadel en PADEL25 (Playtomic) — zie scripts/poll-availability.ts. Overige clubs tonen nog de handmatige status. Zie PROJECTPLAN.md §7 en API_REQUIREMENTS.md voor de details per club.</p>
    </main>
  );
}
