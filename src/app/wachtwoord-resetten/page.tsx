"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Sluitstuk van de wachtwoord-vergeten flow. Supabase stuurt de gebruiker via
 * de mail terug naar deze pagina met een recovery-token in de URL-fragment
 * (#access_token=...&type=recovery). De supabase-js client pikt dat fragment
 * zelf op en zet er een tijdelijke sessie mee op — daarom hoeven we het token
 * hier niet zelf uit de URL te vissen; we wachten tot de sessie er is en
 * kunnen dan updateUser() aanroepen.
 */
export default function WachtwoordResettenPage() {
  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaling, setHerhaling] = useState("");
  const [bericht, setBericht] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [sessieKlaar, setSessieKlaar] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();
    // PASSWORD_RECOVERY vuurt zodra de client het token uit de URL heeft
    // omgezet in een sessie. getSession() dekt het geval dat dat al gebeurd
    // was voordat deze component gemonteerd werd.
    const { data: abonnement } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setSessieKlaar(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessieKlaar(true);
    });
    return () => abonnement.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFout(null);
    setBericht(null);
    if (wachtwoord.length < 6) { setFout("Kies een wachtwoord van minimaal 6 tekens."); return; }
    if (wachtwoord !== herhaling) { setFout("De twee wachtwoorden zijn niet gelijk."); return; }
    setBezig(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: wachtwoord });
    setBezig(false);
    if (error) { setFout(error.message); return; }
    setBericht("Je wachtwoord is gewijzigd. Je wordt doorgestuurd naar je account…");
    setTimeout(() => { router.push("/account"); router.refresh(); }, 1500);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/login" className="mb-6 text-sm text-court-700 hover:underline">&larr; Naar inloggen</Link>
      <h1 className="text-2xl font-bold text-slate-900">Nieuw wachtwoord kiezen</h1>

      {!sessieKlaar && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Deze pagina werkt alleen via de link uit de reset-mail. Geen link ontvangen?{" "}
          <Link href="/login" className="font-medium underline">Vraag een nieuwe aan</Link>.
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="sr-only" htmlFor="nieuw-wachtwoord">Nieuw wachtwoord</label>
        <input id="nieuw-wachtwoord" type="password" required minLength={6} value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)} placeholder="Nieuw wachtwoord"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <label className="sr-only" htmlFor="herhaal-wachtwoord">Herhaal wachtwoord</label>
        <input id="herhaal-wachtwoord" type="password" required minLength={6} value={herhaling}
          onChange={(e) => setHerhaling(e.target.value)} placeholder="Herhaal wachtwoord"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={bezig || !sessieKlaar} type="submit"
          className="w-full rounded-md bg-court-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-court-700 disabled:opacity-50">
          {bezig ? "Bezig…" : "Wachtwoord opslaan"}
        </button>
      </form>

      {fout && <p className="mt-3 text-sm text-red-600">{fout}</p>}
      {bericht && <p className="mt-3 text-sm text-court-700">{bericht}</p>}
    </main>
  );
}
