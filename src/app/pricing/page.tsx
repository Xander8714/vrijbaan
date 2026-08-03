// Geen client-interactiviteit meer nodig: de Pro-knop is nog uitgeschakeld
// tot 2027 (zie hieronder), dus geen "use client" / checkout-fetch hier.
// De checkout-flow (src/app/api/checkout, src/app/api/webhook) blijft
// bestaan voor als het betaalde plan daadwerkelijk actief wordt.
import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/" className="text-sm text-court-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-4xl font-bold text-slate-900">Prijzen</h1>
      <p className="mt-2 text-slate-600">
        VrijeBaan is <span className="font-semibold text-court-700">dit jaar (2026) volledig gratis</span> — we
        testen nog met een kleine groep. Vanaf 2027 kan een betaald plan bijkomen zodra er genoeg gebruikers zijn.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="bal-stippen rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Nu: alles gratis</h2>
          <p className="mt-1 text-3xl font-bold text-slate-900">€0</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>✓ Onbeperkt clubs volgen</li>
            <li>✓ Onbeperkte meldingen (Radar + Telegram)</li>
            <li>✓ Wekelijkse herinnering voor je vaste speelmoment</li>
          </ul>
        </div>
        <div className="rounded-xl bg-ink-900 p-6 shadow-md">
          <span className="inline-block rounded-full bg-ball-400 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-ink-950">
            Vanaf 2027
          </span>
          <p className="mt-3 text-3xl font-bold text-white">€2<span className="text-base font-normal text-slate-400">/mnd</span></p>
          <p className="text-sm text-slate-400">
            of €15/jaar <span className="text-ball-400">— bespaar €9 (dat is €1,25/mnd)</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            <li>Alleen als VrijeBaan meer dan 100 accounts heeft</li>
            <li>Bestaande gratis gebruikers krijgen ruim vooraf bericht</li>
          </ul>
          <button
            disabled
            title="Nog niet actief — vanaf 2027, alleen bij voldoende gebruikers"
            className="mt-6 w-full cursor-not-allowed rounded-md bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-400"
          >
            Nog niet beschikbaar
          </button>
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400">
        Speel je nu al mee als tester? Bedankt — dat helpt enorm. Er verandert niets aan je account tot we hierover
        vooraf communiceren.
      </p>
    </main>
  );
}
