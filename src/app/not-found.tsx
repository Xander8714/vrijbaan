import type { Metadata } from "next";
import Link from "next/link";

// Vangt twee gevallen met dezelfde pagina (Xander, 5 aug 2026 — "een 404 met
// niks is niet netjes"): (1) een URL die nergens op matcht, en (2) een
// bewuste notFound()-aanroep in een pagina zelf. Dat laatste gebruiken we al
// op twee plekken:
// - padelbaan-vrij/[stad]/page.tsx voor een onbekende stad-slug;
// - beheer/social-media/page.tsx voor een ingelogde niet-beheerder — bewust
//   notFound() i.p.v. een 403/login-scherm, zodat we aan een willekeurige
//   bezoeker niet eens bevestigen dát er een beheerpagina bestaat.
// Eén nette pagina hier dekt dus zowel "bestaat niet" als "geen toegang toe".
// Next.js geeft hier automatisch de 404-statuscode en een noindex-meta bij
// (zie not-found.md), dus daar hoeven we zelf niets voor te doen.
export const metadata: Metadata = { title: "Pagina niet gevonden" };

export default function NietGevonden() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-court-700">Foutcode 404</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Deze baan bestaat niet</h1>
      <p className="mt-4 max-w-md text-slate-600">
        De pagina die je zoekt is er niet (meer), of je hebt er geen toegang toe. Misschien is de link verlopen,
        of stond er een typefout in.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/radar"
          className="rounded-md bg-ball-400 px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-ball-300"
        >
          Naar de Radar
        </Link>
        <Link
          href="/"
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Terug naar home
        </Link>
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Of bekijk de{" "}
        <Link href="/help" className="font-medium text-court-700 hover:underline">
          veelgestelde vragen
        </Link>
        .
      </p>
    </main>
  );
}
