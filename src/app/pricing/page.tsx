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
      <Link href="/" className="text-sm text-emerald-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-4xl font-bold text-slate-900">Prijzen</h1>
      <p className="mt-2 text-slate-600">Gratis om te proberen, betaal alleen als je meerdere clubs en teams wilt volgen.</p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Gratis</h2>
          <p className="mt-1 text-3xl font-bold text-slate-900">€0</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>✓ 1 club volgen</li>
            <li>✓ Opstelling-optimizer (onbeperkt)</li>
            <li>✓ 3 meldingen per week</li>
          </ul>
        </div>
        <div className="rounded-xl border-2 border-emerald-500 bg-white p-6 shadow-md">
          <h2 className="text-lg font-semibold text-emerald-700">Pro</h2>
          <p className="mt-1 text-3xl font-bold text-slate-900">€4,99<span className="text-base font-normal text-slate-500">/mnd</span></p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>✓ Alle 8 clubs volgen</li>
            <li>✓ Onbeperkte meldingen</li>
            <li>✓ Meerdere teams opslaan</li>
          </ul>
          <button onClick={upgrade} disabled={bezig} className="mt-6 w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{bezig ? "Bezig…" : "Upgrade naar Pro"}</button>
          {fout && <p className="mt-2 text-xs text-red-600">{fout}</p>}
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400">Betaling via Stripe. Werkt zodra STRIPE_SECRET_KEY en STRIPE_PRICE_ID_PRO zijn ingesteld — zie README.</p>
    </main>
  );
}
