"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [modus, setModus] = useState<"inloggen" | "registreren">("inloggen");
  const [bericht, setBericht] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBericht(null); setBezig(true);
    const supabase = supabaseBrowser();
    const { error } = modus === "inloggen"
      ? await supabase.auth.signInWithPassword({ email, password: wachtwoord })
      : await supabase.auth.signUp({ email, password: wachtwoord });
    setBezig(false);
    if (error) { setBericht(error.message); return; }
    if (modus === "registreren") { setBericht("Account aangemaakt. Check je mail om te bevestigen, log daarna in."); return; }
    router.push("/account"); router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-sm text-emerald-700 hover:underline">&larr; Terug</Link>
      <h1 className="text-2xl font-bold text-slate-900">{modus === "inloggen" ? "Inloggen" : "Account aanmaken"}</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mailadres" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input type="password" required minLength={6} value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} placeholder="Wachtwoord" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={bezig} type="submit" className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{bezig ? "Bezig…" : modus === "inloggen" ? "Inloggen" : "Registreren"}</button>
      </form>
      {bericht && <p className="mt-3 text-sm text-slate-600">{bericht}</p>}
      <button onClick={() => setModus(modus === "inloggen" ? "registreren" : "inloggen")} className="mt-4 text-sm text-emerald-700 hover:underline">
        {modus === "inloggen" ? "Nog geen account? Registreren" : "Al een account? Inloggen"}
      </button>
    </main>
  );
}
