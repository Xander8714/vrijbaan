import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STAD_SLUGS, haalStadData, clubsOpAfstand, boekingssystemenTekst, type StadSlug } from "@/lib/stadsPaginas";

// Straal voor de Radar-CTA: ruim genoeg om ook net-buiten-de-stad-clubs mee
// te nemen (bv. Haarlemmerstroom net buiten Haarlem-centrum), binnen de
// nieuwe 25km-max van de straal-slider (zie radar/page.tsx, 3 aug 2026).
const CTA_STRAAL_KM = 15;

function isStadSlug(waarde: string): waarde is StadSlug {
  return (STAD_SLUGS as string[]).includes(waarde);
}

export async function generateStaticParams() {
  return STAD_SLUGS.map((stad) => ({ stad }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stad: string }>;
}): Promise<Metadata> {
  const { stad } = await params;
  if (!isStadSlug(stad)) return {};
  const info = haalStadData(stad);
  const title = `Padelbaan vrij in ${info.naam}`;
  const description = `${info.totaalBanen} padelbanen bij ${info.clubs.length} clubs in ${info.naam}, verdeeld over ${boekingssystemenTekst(info.systemen.length)}. Zie live welke plek nu vrij is.`;
  return { title, description, alternates: { canonical: `/padelbaan-vrij/${stad}` } };
}

export default async function StadPagina({ params }: { params: Promise<{ stad: string }> }) {
  const { stad } = await params;
  if (!isStadSlug(stad)) notFound();

  const info = haalStadData(stad);
  const clubs = clubsOpAfstand(info);
  const radarLink = `/radar?lat=${info.centrum.lat}&lon=${info.centrum.lon}&plaats=${encodeURIComponent(info.naam)}&straal=${CTA_STRAAL_KM}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-court-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Padelbaan vrij in {info.naam}</h1>
      <p className="mt-3 text-slate-600">{info.intro}</p>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{info.totaalBanen}</p>
          <p className="mt-1 text-xs text-slate-500">padelbanen</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{info.clubs.length}</p>
          <p className="mt-1 text-xs text-slate-500">clubs</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{info.systemen.length}</p>
          <p className="mt-1 text-xs text-slate-500">boekingssystemen</p>
        </div>
      </div>

      <Link
        href={radarLink}
        className="mt-8 block rounded-xl bg-ink-900 p-6 text-white transition hover:bg-ink-800"
      >
        <p className="text-lg font-semibold">Bekijk nu live welke baan vrij is in {info.naam} →</p>
        <p className="mt-1 text-sm text-slate-300">De Radar checkt alle clubs hieronder tegelijk, geen losse apps nodig.</p>
      </Link>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">Clubs in {info.naam}</h2>
      <ul className="mt-4 space-y-2">
        {clubs.map((club) => (
          <li key={club.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">{club.naam}</p>
              <p className="text-slate-500">{club.systeem}{club.banen > 0 ? ` · ${club.banen} banen` : ""}</p>
            </div>
            {club.afstandKm > 0 && <span className="text-xs text-slate-400">{club.afstandKm} km</span>}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-slate-400">
        Zoek je liever een andere plaats? Ga naar de <Link href="/radar" className="underline">Radar</Link> en vul je
        eigen locatie in.
      </p>
    </main>
  );
}
