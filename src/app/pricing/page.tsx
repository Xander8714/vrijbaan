"use client";
import { useState } from "react";
import Link from "next/link";

export default function PricingPage() {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const upgrade = async () => {
    setBezig(true); setFout(null);
    const res = await fetch("/api/checkout", { method: "POST" });
    const data = await res.json();
    setBezig(false);
    if (data.url) window.location.href = data.url;
    else setFout(data.error ?? "Er ging iets mis.");
  };
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/" className="text-sm text-court-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-4xl font-bold text-slate-900">Prijzen</h1>
      <p className="mt-2 text-slate-600">Gratis om te proberen, betaal alleen als je meerdere clubs en teams wilt volgen.</p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="bal-stippen rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Gratis</h2>
          <p className="mt-1 text-3xl font-bold text-slate-900">€0</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>✓ 1 club volgen</li>
            <li>✓ 3 meldingen per week</li>
          </ul>
        </div>
        <div className="rounded-xl bg-ink-900 p-6 shadow-md">
          <span className="inline-block rounded-full bg-ball-400 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-ink-950">Pro</span>
          <p className="mt-3 text-3xl font-bold text-white">€4,99<span className="text-base font-normal text-slate-400">/mnd</span></p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>✓ Onbeperkt clubs volgen</li>
            <li>✓ Onbeperkte meldingen</li>
          </ul>
          <button onClick={upgrade} disabled={bezig} className="mt-6 w-full rounded-md bg-ball-400 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-ball-300 disabled:opacity-50">{bezig ? "Bezig…" : "Upgrade naar Pro"}</button>
          {fout && <p className="mt-2 text-xs text-red-400">{fout}</p>}
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400">Betaling via Stripe. Werkt zodra STRIPE_SECRET_KEY en STRIPE_PRICE_ID_PRO zijn ingesteld — zie README.</p>
    </main>
  );
}
