import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help & veelgestelde vragen",
  description: "Hoe je een padelbaan volgt, een melding krijgt zodra er een plek vrijkomt, en antwoord op veelgestelde vragen over VrijeBaan.",
  alternates: { canonical: "/help" },
};

const usecases = [
  {
    titel: "Ik wil weten zodra er een baan vrijkomt bij mijn club",
    stappen: [
      "Registreer of log in, ga naar Radar en klik bij een club op 'Volg deze club'.",
      "Klik op je accountpagina op 'Koppel Telegram' — dit opent Telegram automatisch bij onze bot (@vrijbaan_notify_bot). Druk daar op Start.",
      "Klaar: je krijgt daar automatisch een berichtje zodra er bij een gevolgde club een nieuw slot vrijkomt.",
    ],
  },
  {
    titel: "Ik wil vanuit Telegram zelf een baan zoeken",
    stappen: [
      "Koppel de bot eerst via je accountpagina (zie hierboven) — daarna typ je gewoon in diezelfde chat.",
      "Typ iets als 'zoek een baan in Haarlem rond 20:00'.",
      "Zie de Telegram-uitlegpagina voor meer voorbeelden en alles wat de bot verder kan.",
    ],
  },
];
const faq = [
  { vraag: "Wat moet ik in Telegram zoeken om bij de bot te komen?", antwoord: "Meestal hoef je niks te zoeken: de knop 'Koppel Telegram' op je accountpagina opent Telegram automatisch bij de juiste bot. Werkt die link niet (bv. je zit al in de Telegram-app op een ander toestel), zoek dan zelf naar @vrijbaan_notify_bot en druk op Start." },
  { vraag: "Wat betekent speelsterkte 1 tot 9?", antwoord: "De officiële KNLTB-schaal: 1 is sterkste, 9 is beginnend. Het sterkste koppel speelt wedstrijd 1." },
  { vraag: "Kan ik de app op mijn telefoon zetten?", antwoord: "Ja — open de site in je mobiele browser en kies 'Toevoegen aan beginscherm'." },
  { vraag: "Wat kost het?", antwoord: "VrijeBaan zit in de testfase. Na registratie kun je de Radar en Telegram nu gratis gebruiken. Zie de prijzenpagina voor het plan vanaf 2027." },
  { vraag: "Van wie komt de bevestigingsmail?", antwoord: "De bevestigingsmail na registratie wordt verzonden door Supabase, de beveiligde dienst die VrijeBaan voor accounts gebruikt. Controleer ook je spamfolder." },
];

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-court-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Help &amp; Use cases</h1>
      <p className="mt-3 rounded-lg border border-court-200 bg-court-50 px-4 py-3 text-sm text-court-900">
        Gebruik je liever Telegram? Bekijk de{" "}
        <Link href="/telegram" className="font-medium underline">
          uitleg over de Telegram-bot
        </Link>{" "}
        — koppelen, losse zoekopdrachten en vaste speelmomenten.
      </p>
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-slate-900">Zo gebruik je VrijeBaan</h2>
        <div className="mt-4 space-y-4">
          {usecases.map((u) => (
            <div key={u.titel} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="font-medium text-slate-900">{u.titel}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">{u.stappen.map((s, i) => (<li key={i}>{s}</li>))}</ol>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">Veelgestelde vragen</h2>
        <div className="mt-4 space-y-3">
          {faq.map((f) => (
            <details key={f.vraag} className="rounded-lg border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer font-medium text-slate-900">{f.vraag}</summary>
              <p className="mt-2 text-sm text-slate-600">{f.antwoord}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="mt-10 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
        <p className="mt-2 text-sm text-slate-600">
          Vraag over hoe iets werkt, een bug gevonden, of iets anders?{" "}
          <a href="mailto:support@devrijebaan.nl" className="text-court-700 underline">support@devrijebaan.nl</a>.
          Voor algemene vragen, samenwerkingen of iets anders:{" "}
          <a href="mailto:info@devrijebaan.nl" className="text-court-700 underline">info@devrijebaan.nl</a>.
        </p>
      </section>
    </main>
  );
}
