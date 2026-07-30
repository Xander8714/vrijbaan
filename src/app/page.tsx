import Link from "next/link";
import { RacketIcon, BalIcon } from "@/components/PadelIcons";

export default function Home() {
  return (
    <main>
      {/* Donkere hero met het baanlijnen-patroon: dit is waar het "luxe
          sportief"-gevoel vandaan moet komen — de rest van de app blijft
          licht/kaart-gebaseerd voor leesbaarheid tijdens het zoeken. */}
      <div className="baan-achtergrond bg-ink-900">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-ball-400">
            <BalIcon className="h-4 w-4" />
            Begonnen in Haarlem, nu landelijk
          </div>
          <h1 className="mt-3 flex items-center gap-3 text-5xl font-extrabold tracking-tight text-white">
            VrijBaan
            <RacketIcon className="h-9 w-9 text-court-300" />
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-300">
            Vrij baan om te padellen. VrijBaan bundelt live beschikbaarheid van padelclubs bij jou in de buurt — zoek
            op adres, stel je straal in en boek direct bij de club zelf.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/radar"
              className="rounded-md bg-ball-400 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-sm transition hover:bg-ball-300"
            >
              Bekijk beschikbaarheid →
            </Link>
            <Link
              href="/pricing"
              className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Bekijk prijzen
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/radar"
          className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-court-300 hover:shadow-md"
        >
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900 group-hover:text-court-700">
            Beschikbaarheid Radar
            <span aria-hidden="true">→</span>
          </h2>
          <p className="mt-2 text-sm text-slate-500">Volg je favoriete clubs en krijg een seintje zodra er een baan vrijkomt.</p>
        </Link>
        <div className="mt-6">
          <Link href="/help" className="text-sm font-medium text-court-700 hover:underline">
            Hoe werkt het? →
          </Link>
        </div>
        <p className="mt-12 text-xs text-slate-400">MVP-versie — zie PROJECTPLAN.md voor de volledige uitwerking.</p>
      </div>
    </main>
  );
}
