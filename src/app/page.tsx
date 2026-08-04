import type { Metadata } from "next";
import Link from "next/link";
import { RacketIcon, BalIcon } from "@/components/PadelIcons";
import { CLUBS_INCLUSIEF_LEDENCLUBS } from "@/lib/clubs";
import { STAD_SLUGS, haalStadData } from "@/lib/stadsPaginas";
import HeroInlogKnop from "@/components/HeroInlogKnop";

export const metadata: Metadata = {
  title: "Vind een vrije padelbaan in de buurt",
  description:
    "Live beschikbaarheid van padelbanen bij jou in de buurt — Playtomic-, KNLTB Meet & Play- en Peakz-clubs door heel Nederland. Zoek op adres, filter op tijd, en boek direct bij de club.",
  alternates: { canonical: "/" },
};

// Live geteld uit de eigen clubdata (niet hardcoded) — Xander (3 aug 2026):
// homepage miste een vertrouwenssignaal ("is dit al echt?") voor een
// onbekende bezoeker. Telt alle aangesloten clubs mee (ook ledenclubs), want
// die zijn wel degelijk via de scrapers gekoppeld, ook al is boeken daar
// beperkt tot leden.
const TOTAAL_BANEN = CLUBS_INCLUSIEF_LEDENCLUBS.reduce((som, club) => som + club.banen, 0);
const TOTAAL_CLUBS = CLUBS_INCLUSIEF_LEDENCLUBS.length;

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
            VrijeBaan
            <RacketIcon className="h-9 w-9 text-court-300" />
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-300">
            Vrij baan om te padellen. VrijeBaan bundelt live beschikbaarheid van padelclubs bij jou in de buurt — zoek
            op adres, stel je straal in en boek direct bij de club zelf.
          </p>
          <p className="mt-3 text-sm font-medium text-ball-400">
            Nu al {TOTAAL_BANEN} padelbanen aangesloten bij {TOTAAL_CLUBS} clubs door heel Nederland.
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
            <HeroInlogKnop />
          </div>
        </div>
      </div>

      {/* Voorheen een licht blok tussen de donkere hero en de donkere footer
          (Xander, 4 aug 2026: "maak dat gedeelte ook gewoon net als de
          pagina de donkere kleuren") — nu één doorlopende donkere sectie tot
          aan de footer, met de steden in het geel (ball-400) zoals gevraagd. */}
      <div className="baan-achtergrond bg-ink-900">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link
            href="/radar"
            className="group block rounded-xl border border-ink-700 bg-ink-800 p-6 shadow-sm transition hover:border-ball-400/50 hover:shadow-md"
          >
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white group-hover:text-ball-400">
              Beschikbaarheid Radar
              <span aria-hidden="true">→</span>
            </h2>
            <p className="mt-2 text-sm text-slate-400">Volg je favoriete clubs en krijg een seintje zodra er een baan vrijkomt.</p>
          </Link>

          <div className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Padelbaan vrij in</h3>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              {STAD_SLUGS.map((slug) => (
                <Link key={slug} href={`/padelbaan-vrij/${slug}`} className="text-sm font-medium text-ball-400 hover:underline">
                  {haalStadData(slug).naam}
                </Link>
              ))}
              <Link href="/padelbaan-vrij" className="text-sm font-medium text-slate-400 hover:text-white hover:underline">
                Alle steden →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
