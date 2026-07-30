"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type Modus = "inloggen" | "registreren" | "vergeten";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [modus, setModus] = useState<Modus>("inloggen");
  const [bericht, setBericht] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const router = useRouter();

  const wisselNaar = (nieuw: Modus) => { setModus(nieuw); setBericht(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBericht(null); setBezig(true);
    const supabase = supabaseBrowser();

    if (modus === "vergeten") {
      // Supabase mailt een recovery-link; redirectTo bepaalt waar die link
      // uitkomt. De pagina /wachtwoord-resetten handelt het token af.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/wachtwoord-resetten`,
      });
      setBezig(false);
      // Bewust geen onderscheid tussen "bestaat" en "bestaat niet": dat zou
      // verklappen welke e-mailadressen een account hebben.
      setBericht(
        error
          ? error.message
          : "Als dit e-mailadres bij ons bekend is, staat er nu een reset-link in je inbox. Check ook je spamfolder."
      );
      return;
    }

    const { error } = modus === "inloggen"
      ? await supabase.auth.signInWithPassword({ email, password: wachtwoord })
      : await supabase.auth.signUp({ email, password: wachtwoord });
    setBezig(false);
    if (error) { setBericht(error.message); return; }
    if (modus === "registreren") { setBericht("Account aangemaakt. Check je mail om te bevestigen, log daarna in."); return; }
    router.push("/account"); router.refresh();
  };

  const kop = modus === "inloggen" ? "Inloggen" : modus === "registreren" ? "Account aanmaken" : "Wachtwoord vergeten";
  const knop = modus === "inloggen" ? "Inloggen" : modus === "registreren" ? "Registreren" : "Stuur reset-link";

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-sm text-court-700 hover:underline">&larr; Terug</Link>
      <h1 className="text-2xl font-bold text-slate-900">{kop}</h1>

      {modus === "vergeten" && (
        <p className="mt-2 text-sm text-slate-600">
          Vul je e-mailadres in. Je krijgt een link waarmee je zelf een nieuw wachtwoord kiest.
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="sr-only" htmlFor="email">E-mailadres</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mailadres" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        {modus !== "vergeten" && (
          <>
            <label className="sr-only" htmlFor="wachtwoord">Wachtwoord</label>
            <input id="wachtwoord" type="password" required minLength={6} value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} placeholder="Wachtwoord" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </>
        )}
        <button disabled={bezig} type="submit" className="w-full rounded-md bg-court-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-court-700 disabled:opacity-50">{bezig ? "Bezig…" : knop}</button>
      </form>

      {bericht && <p className="mt-3 text-sm text-slate-600">{bericht}</p>}

      <div className="mt-4 flex flex-col items-start gap-2 text-sm">
        {modus !== "inloggen" && (
          <button onClick={() => wisselNaar("inloggen")} className="text-court-700 hover:underline">Al een account? Inloggen</button>
        )}
        {modus !== "registreren" && (
          <button onClick={() => wisselNaar("registreren")} className="text-court-700 hover:underline">Nog geen account? Registreren</button>
        )}
        {modus !== "vergeten" && (
          <button onClick={() => wisselNaar("vergeten")} className="text-slate-500 hover:underline">Wachtwoord vergeten?</button>
        )}
      </div>
    </main>
  );
}
