import type { Metadata } from "next";
import Link from "next/link";
import { STAD_SLUGS, haalStadData, boekingssystemenTekst } from "@/lib/stadsPaginas";

// Stedennamen in de description niet meer hardcoded — die liep al eens uit
// de pas met de echte lijst (nog "Apeldoorn en Eindhoven" toen die er allang
// uit waren, 4 aug 2026). Nu afgeleid uit STAD_SLUGS zoals de rest van deze
// pagina.
export async function generateMetadata(): Promise<Metadata> {
  const namen = STAD_SLUGS.map((slug) => haalStadData(slug).naam);
  const namenTekst = namen.length > 1 ? `${namen.slice(0, -1).join(", ")} en ${namen.at(-1)}` : namen[0];
  return {
    title: "Padelbaan vrij per stad",
    description: `Kies je stad en zie live hoeveel padelbanen er vrij zijn — ${namenTekst}.`,
    alternates: { canonical: "/padelbaan-vrij" },
  };
}

export default function StedenOverzicht() {
  const steden = STAD_SLUGS.map((slug) => haalStadData(slug));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-court-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Padelbaan vrij per stad</h1>
      <p className="mt-3 text-slate-600">
        Kies je stad hieronder voor het volledige clubaanbod en een directe link naar de live Radar. De Radar is
        tijdens de testfase gratis te gebruiken na registratie.
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
        locatie in — na gratis registratie doorzoekt die alle aangesloten clubs door heel Nederland, niet alleen deze zes.
      </p>
    </main>
  );
}
