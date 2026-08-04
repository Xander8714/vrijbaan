import type { Metadata } from "next";
import Link from "next/link";
import { STAD_SLUGS, haalStadData, boekingssystemenTekst } from "@/lib/stadsPaginas";

export const metadata: Metadata = {
  title: "Padelbaan vrij per stad",
  description:
    "Kies je stad en zie live hoeveel padelbanen er vrij zijn — Amsterdam, Haarlem, Groningen, Utrecht, Apeldoorn en Eindhoven.",
  alternates: { canonical: "/padelbaan-vrij" },
};

export default function StedenOverzicht() {
  const steden = STAD_SLUGS.map((slug) => haalStadData(slug));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-court-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Padelbaan vrij per stad</h1>
      <p className="mt-3 text-slate-600">
        Kies je stad hieronder voor het volledige clubaanbod en een directe link naar de live Radar.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {steden.map((stad) => (
          <li key={stad.slug}>
            <Link
              href={`/padelbaan-vrij/${stad.slug}`}
              className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-court-300 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-slate-900 group-hover:text-court-700">{stad.naam}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {stad.totaalBanen} banen · {stad.clubs.length} clubs · {boekingssystemenTekst(stad.systemen.length)}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-slate-400">
        Staat jouw stad er niet bij? Ga naar de <Link href="/radar" className="underline">Radar</Link> en vul je eigen
        locatie in — die doorzoekt alle aangesloten clubs door heel Nederland, niet alleen deze zes.
      </p>
    </main>
  );
}
