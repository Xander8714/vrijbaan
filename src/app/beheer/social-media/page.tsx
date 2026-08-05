import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { haalSocialMediaAdmin } from "@/lib/socialMedia/admin";
import { haalSocialPostsVoorBeheer } from "@/lib/socialMedia/repository";
import { aantalSocialVisualSlides } from "@/lib/socialMedia/visual";
import { archiveerConceptAction, genereerConceptAction, keurConceptGoedAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Socialmediabeheer", robots: { index: false, follow: false } };

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Wacht op goedkeuring",
  approved: "Goedgekeurd",
  scheduled: "Gepland",
  published: "Gepubliceerd",
  failed: "Mislukt",
  archived: "Gearchiveerd",
  draft: "Concept",
};

function datumTijd(waarde: string | null): string {
  if (!waarde) return "—";
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(waarde));
}

function datumTijdInput(waarde: string | null): string | undefined {
  if (!waarde) return undefined;
  const delen = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Europe/Amsterdam",
  }).formatToParts(new Date(waarde));
  const deel = (type: Intl.DateTimeFormatPartTypes) => delen.find((item) => item.type === type)?.value ?? "";
  return `${deel("year")}-${deel("month")}-${deel("day")}T${deel("hour")}:${deel("minute")}`;
}

export default async function SocialMediaBeheerPage() {
  const admin = await haalSocialMediaAdmin();
  if (!admin) {
    // Niet-beheerders krijgen bewust geen bevestiging dat dit beheergebied bestaat.
    notFound();
  }
  const posts = await haalSocialPostsVoorBeheer();
  const wachtend = posts.filter((post) => post.status === "pending_approval");
  const verwerkt = posts.filter((post) => post.status !== "pending_approval");

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-court-700">Beheer</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Socialmedia-agent</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Goedkeuringsmodus: nieuwe content wordt nooit automatisch gepubliceerd.
          </p>
        </div>
        <form action={genereerConceptAction}>
          <button className="rounded-lg bg-court-700 px-5 py-3 font-semibold text-white shadow-sm hover:bg-court-800">
            Genereer nieuw concept
          </button>
        </form>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-900">Te beoordelen ({wachtend.length})</h2>
        {wachtend.length === 0 ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Er wachten geen concepten.</p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {wachtend.map((post) => (
              <article key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className={`grid ${aantalSocialVisualSlides(post.visual) > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {Array.from({ length: aantalSocialVisualSlides(post.visual) }, (_, slide) => (
                    <Image key={slide} src={`/api/beheer/social-media/${post.id}/visual?slide=${slide}`}
                      alt={`Socialmedia-visual ${slide + 1} voor ${post.city ?? "De Vrije Baan"}`}
                      width={1080} height={1080} className="aspect-square w-full object-cover" unoptimized />
                  ))}
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Wacht op goedkeuring</span>
                    <span className="text-slate-500">{post.platforms.join(" + ")}</span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.caption}</p>
                  <dl className="mt-5 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div><dt className="font-semibold text-slate-700">Bron bijgewerkt</dt><dd>{datumTijd(post.sourceUpdatedAt)}</dd></div>
                    <div><dt className="font-semibold text-slate-700">Concept gemaakt</dt><dd>{datumTijd(post.createdAt)}</dd></div>
                  </dl>
                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <form action={keurConceptGoedAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <input type="hidden" name="id" value={post.id} />
                      <label className="flex-1 text-sm font-medium text-slate-700">
                        Publicatiemoment (optioneel)
                        <input name="scheduledFor" type="datetime-local" defaultValue={datumTijdInput(post.scheduledFor)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
                      </label>
                      <button className="rounded-md bg-court-700 px-4 py-2 font-semibold text-white hover:bg-court-800">
                        Goedkeuren
                      </button>
                    </form>
                    <form action={archiveerConceptAction} className="mt-3">
                      <input type="hidden" name="id" value={post.id} />
                      <button className="text-sm font-medium text-slate-500 underline hover:text-red-700">Afwijzen en archiveren</button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">Historie</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Status</th><th className="px-4 py-3">Onderwerp</th><th className="px-4 py-3">Aangemaakt</th><th className="px-4 py-3">Gepland</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {verwerkt.map((post) => (
                <tr key={post.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{STATUS_LABEL[post.status] ?? post.status}</td>
                  <td className="px-4 py-3 text-slate-600">{post.city ?? post.subjectKey}</td>
                  <td className="px-4 py-3 text-slate-600">{datumTijd(post.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{datumTijd(post.scheduledFor)}</td>
                </tr>
              ))}
              {verwerkt.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Nog geen historie.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
