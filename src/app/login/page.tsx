"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type Modus = "inloggen" | "registreren" | "vergeten";

// useSearchParams() (voor ?fout=oauth, zie hieronder) vereist een eigen
// Suspense-grens — anders faalt de build met "should be wrapped in a
// suspense boundary". De fallback is bewust identiek aan het echte begin
// van de pagina (kop + lege knoppen zonder werking), zodat er geen
// merkbare flits/lege pagina is tijdens de eerste render.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormulierSkelet />}>
      <LoginFormulier />
    </Suspense>
  );
}

function LoginFormulierSkelet() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-sm text-court-700 hover:underline">&larr; Terug</Link>
      <h1 className="text-2xl font-bold text-slate-900">Inloggen</h1>
    </main>
  );
}

function LoginFormulier() {
  const zoekParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [modus, setModus] = useState<Modus>("inloggen");
  // Begint gevuld als /auth/callback net terugstuurde met ?fout=oauth (bv.
  // een verlopen/al-gebruikte code) — anders blijft de gebruiker met een
  // stille, lege inlogpagina zitten zonder te weten wat er misging.
  const [bericht, setBericht] = useState<string | null>(() =>
    zoekParams.get("fout") === "oauth" ? "Inloggen met Google is niet gelukt. Probeer het nog eens." : null
  );
  const [bezig, setBezig] = useState(false);
  const router = useRouter();

  const wisselNaar = (nieuw: Modus) => { setModus(nieuw); setBericht(null); };

  // Google logt in óf maakt het account aan, al naar gelang of dit
  // e-mailadres al bekend is — dezelfde knop dekt dus zowel "inloggen" als
  // "registreren". next=/account: eerste keer landt de gebruiker meteen bij
  // het profiel, net als na een gewone e-mailregistratie.
  const inloggenMetGoogle = async () => {
    setBericht(null); setBezig(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/account` },
    });
    // Bij succes navigeert de browser meteen weg naar Google — bezig blijft
    // dan bewust op true (er is geen "klaar"-moment op deze pagina zelf).
    if (error) { setBezig(false); setBericht(error.message); }
  };

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
      : await supabase.auth.signUp({
          email,
          password: wachtwoord,
          // Na het bevestigen van de e-mail direct naar de Telegram-koppelstap
          // i.p.v. de kale homepage — Xander (3 aug 2026: "een snellere manier"
          // voor account maken + Telegram koppelen). Dit is de kortste stap die
          // veilig kan zonder de e-mailbevestiging zelf uit te zetten (dat is
          // een echte security-afweging, geen UI-detail — die beslissing is aan
          // Xander, niet iets wat ik zelf omzet).
          options: { emailRedirectTo: `${window.location.origin}/account?welkom=1` },
        });
    setBezig(false);
    if (error) { setBericht(error.message); return; }
    if (modus === "registreren") {
      // Xander (4 aug 2026): "als je geregistreerd hebt moet die naar login" —
      // bleef anders op het registratieformulier hangen, wat de indruk wekte
      // dat er niets gebeurd was. E-mailadres blijft ingevuld staan (wachtwoord
      // is hetzelfde als net getypt), dus inloggen na het bevestigen is één klik.
      setModus("inloggen");
      setBericht("Account aangemaakt. Check je mail om te bevestigen, log daarna hieronder in.");
      // Los van de gebruikersflow — een mislukte eigenaarsmelding mag een
      // geslaagde registratie nooit blokkeren, dus bewust niet awaited/gecatched
      // op een manier die de UI raakt.
      fetch("/api/telegram/registratie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => {});
      return;
    }
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

      {/* Google dekt zowel inloggen als registreren in één knop (Supabase
          maakt het account aan bij de eerste keer) — daarom niet getoond bij
          "vergeten", want een Google-account heeft geen wachtwoord bij ons
          om te resetten. */}
      {modus !== "vergeten" && (
        <>
          <button
            type="button"
            onClick={inloggenMetGoogle}
            disabled={bezig}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.61Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33Z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
            </svg>
            Inloggen met Google
          </button>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            of met e-mail
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      <form onSubmit={submit} className={`space-y-3 ${modus === "vergeten" ? "mt-6" : "mt-2"}`}>
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
