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
          {/* Xander (4 aug 2026): "maak duidelijk dat je via telegram
              notificaties krijgt bij een account aanmaken, daar is de app
              natuurlijk om te doen" — de Radar (hierboven) is het zoeken,
              maar het ECHTE punt is dat je niet meer zelf hoeft te zoeken.
              Telegram-blauw als klein, herkenbaar accent — verder gewoon de
              bestaande donkere kaart-stijl. */}
          <div className="mt-6 flex max-w-xl items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-6 w-6 shrink-0 fill-[#2AABEE]" aria-hidden="true">
              <path d="M9.036 15.803 8.83 20.79c.44 0 .63-.19.86-.42l2.07-1.98 4.29 3.14c.79.44 1.35.21 1.56-.73l2.83-13.3c.28-1.15-.42-1.6-1.19-1.32L2.6 10.86c-1.12.44-1.1 1.06-.19 1.34l4.6 1.44 10.68-6.74c.5-.33.96-.15.58.18Z" />
            </svg>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-white">Maak een gratis account en je hoeft nooit meer zelf te checken.</span>{" "}
              Volg een club of stel je vaste speelmoment in, en VrijeBaan stuurt je automatisch een Telegram-bericht
              zodra er een plek vrijkomt.
            </p>
          </div>
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

        {/* Zelfde achtergrond-div als de hero hierboven (Xander, 4 aug 2026:
            "maak dit 1 achtergrond foto") — twee losse .baan-achtergrond-
            divs gaven allebei hun eigen gecentreerde uitsnede van dezelfde
            foto, wat een zichtbare naad opleverde. Nu één doorlopende box,
            dus één continue uitsnede. De "Beschikbaarheid Radar"-kaart die
            hier stond is weg (Xander: dubbelop met de "Bekijk
            beschikbaarheid →"-knop hierboven). */}
        <div className="mx-auto max-w-3xl px-6 pb-16">
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
    </main>
  );
}
