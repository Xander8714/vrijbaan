import Link from "next/link";
export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold tracking-tight text-slate-900">VrijBaan</span>
        <div className="flex gap-4 text-sm font-medium text-slate-600">
          <Link href="/help" className="hover:text-emerald-700">Help</Link>
          <Link href="/pricing" className="hover:text-emerald-700">Prijzen</Link>
          <Link href="/login" className="hover:text-emerald-700">Inloggen</Link>
        </div>
      </nav>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-600">Haarlem + 5 km</p>
        <h1 className="mt-2 text-5xl font-extrabold tracking-tight text-slate-900">VrijBaan</h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600">Vrij baan om te padellen én vrij baan om te winnen. VrijBaan bundelt beschikbaarheid van 8 clubs rond Haarlem en helpt je competitieteam de sterkste opstelling te bepalen.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link href="/radar" className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
            <h2 className="text-xl font-semibold text-slate-900 group-hover:text-emerald-700">Beschikbaarheid Radar →</h2>
            <p className="mt-2 text-sm text-slate-500">Volg je favoriete clubs en krijg een seintje zodra er een baan vrijkomt.</p>
          </Link>
          <Link href="/opstelling" className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
            <h2 className="text-xl font-semibold text-slate-900 group-hover:text-emerald-700">Opstelling Optimizer →</h2>
            <p className="mt-2 text-sm text-slate-500">Bepaal de sterkste koppel-indeling voor je competitieteam.</p>
          </Link>
        </div>
        <div className="mt-6 flex gap-3">
          <Link href="/pricing" className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700">Bekijk prijzen</Link>
          <Link href="/help" className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Hoe werkt het?</Link>
        </div>
        <p className="mt-12 text-xs text-slate-400">MVP-versie — zie PROJECTPLAN.md voor de volledige uitwerking.</p>
      </div>
    </main>
  );
}
