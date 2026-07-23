import Link from "next/link";

const usecases = [
  { titel: "Ik wil weten zodra er een baan vrijkomt bij mijn club", stappen: ["Ga naar Radar.", "Klik 'Volg deze club' bij één of meerdere clubs.", "Zodra de live-koppeling actief is, krijg je een melding zodra er een slot vrijkomt."] },
  { titel: "Ik ben aanvoerder en moet een competitie-opstelling maken", stappen: ["Ga naar Opstelling.", "Voer je beschikbare spelers in met hun KNLTB-speelsterkte.", "Voeg optioneel de tegenstander-spelers toe.", "Klik 'Bereken beste opstelling'."] },
  { titel: "Ik wil meerdere clubs volgen zonder limiet", stappen: ["Maak een account aan via Inloggen.", "Ga naar Prijzen en upgrade naar Pro.", "Je account ontgrendelt direct alle 8 clubs."] },
];
const faq = [
  { vraag: "Waarom zie ik geen echte baanbeschikbaarheid?", antwoord: "De radar draait nu op voorbeelddata. De koppeling met Playtomic en KNLTB Meet & Play is de eerstvolgende bouwstap." },
  { vraag: "Wat betekent speelsterkte 1 tot 9?", antwoord: "De officiële KNLTB-schaal: 1 is sterkste, 9 is beginnend. Het sterkste koppel speelt wedstrijd 1." },
  { vraag: "Kan ik de app op mijn telefoon zetten?", antwoord: "Ja — open de site in je mobiele browser en kies 'Toevoegen aan beginscherm'." },
  { vraag: "Wat kost het?", antwoord: "Gratis om te proberen. Pro is €4,99/maand voor alle clubs en onbeperkte meldingen." },
];

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-emerald-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Help &amp; Use cases</h1>
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-slate-900">Zo gebruik je VrijBaan</h2>
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
    </main>
  );
}
