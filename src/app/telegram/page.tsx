import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Telegram-bot koppelen en gebruiken",
  description:
    "Hoe je de VrijeBaan-bot aan je account koppelt, en wat je er allemaal tegen kunt zeggen: locatie, straal en tijd aanpassen, losse zoekopdrachten, vaste speelmomenten en meldingen.",
  alternates: { canonical: "/telegram" },
};

export default function TelegramPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-court-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">De Telegram-bot</h1>
      <p className="mt-2 text-slate-600">
        VrijeBaan heeft een eigen Telegram-bot die je een berichtje stuurt zodra er een padelbaan vrijkomt, en die je
        ook gewoon rechtstreeks in de chat kunt vragen om te zoeken. Geen vaste commando&apos;s met een <code>/</code> ervoor
        (op één na) — je typt gewoon in normale taal wat je wilt.
      </p>
      <p className="mt-3 rounded-lg border border-court-200 bg-court-50 px-4 py-3 text-sm text-court-900">
        VrijeBaan zit in de testfase. De Radar en Telegram zijn nu gratis te gebruiken na registratie.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-slate-900">1. Koppelen</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Log in en ga naar je <Link href="/account" className="text-court-700 underline">account</Link>.</li>
          <li>Klik bij &quot;Telegram-meldingen&quot; op <strong>Koppel Telegram</strong>. Dit opent Telegram met de bot al open.</li>
          <li>Druk in Telegram op <strong>Start</strong>. De bot koppelt je chat direct aan je account — je hoeft zelf niets
            te typen of over te nemen.</li>
          <li>De bot vraagt daarna twee dingen om je op weg te helpen: <em>waar</em> je meestal padelt (plaatsnaam) en{" "}
            <em>hoe laat</em>. Dit is meteen je basis voor meldingen — je kunt het later altijd aanpassen op je
            accountpagina.</li>
        </ol>
        <p className="mt-3 text-sm text-slate-500">
          Loskoppelen kan altijd via dezelfde plek op je accountpagina (&quot;Ontkoppelen&quot;).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">2. Los een baan zoeken in de chat</h2>
        <p className="mt-2 text-sm text-slate-600">
          Typ op elk moment een zoekopdracht in gewone taal — de bot herkent een plaatsnaam, een tijd en een dag door
          elkaar heen. Deze werken bijvoorbeeld allemaal:
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            "Zoek een baan in Haarlem rond 20:00",
            "Padellen Rijswijk morgen 11:00",
            "Morgen ochtend 1100 padellen Velserbroek",
            "een baan in Heemskerk overmorgen om 9 uur",
          ].map((v) => (
            <li key={v} className="rounded-md bg-court-50 px-3 py-2 font-mono text-court-900">&quot;{v}&quot;</li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 text-sm text-slate-600">
          <p><strong>Tijd:</strong> alleen op het hele of halve uur — typ je iets anders (bv. 11:12), dan rondt de bot af
            naar het dichtstbijzijnde halve uur.</p>
          <p><strong>Dag:</strong>{" "}
            zeg je niets, dan pakt de bot vandaag — tenzij het al na 21:00 is, dan is morgen logischer en kiest de
            bot dat automatisch. Zeg je &quot;morgen&quot; of &quot;overmorgen&quot;, dan geldt dat.</p>
          <p><strong>Straal:</strong> de bot kijkt tot 10 km rond de plaats die je noemt.</p>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Herkent de bot meerdere plaatsen met die naam, dan krijg je knopjes om de juiste te kiezen. Daarna zoekt hij
          direct en stuurt een lijst met tijden — met een link terug naar de Radar om te boeken (je hoeft je daar niet
          nog eens apart in te loggen).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">3. Je voorkeuren aanpassen in de chat</h2>
        <p className="mt-2 text-sm text-slate-600">
          Straal, tijd en locatie hoef je niet meer per se op de accountpagina te wijzigen — de bot begrijpt ze ook
          gewoon in de chat, ook meerdere tegelijk in één bericht:
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            "Maak mijn straal 5 km",
            "Zet mijn tijd op 2000",
            "Maak straal 5 km en zet mijn tijd op 2000",
            "Verander mijn locatie naar Leiden",
          ].map((v) => (
            <li key={v} className="rounded-md bg-court-50 px-3 py-2 font-mono text-court-900">&quot;{v}&quot;</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600">
          <strong>Tijd:</strong> mag met of zonder dubbele punt — 20:00, 2000, 830 of 8 werken allemaal, ook hier
          rondt de bot af naar het dichtstbijzijnde halve uur. Stuur &quot;geen voorkeur&quot; om je tijd weer los te laten.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Herkent de bot bij een locatiewijziging meerdere plaatsen met die naam, dan krijg je — net als bij een
          losse zoekopdracht — knopjes om de juiste te kiezen.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">4. Vaste speelmomenten &amp; meldingen</h2>
        <p className="mt-2 text-sm text-slate-600">
          Speel je altijd op dezelfde dag en tijd? Dat stel je in op je{" "}
          <Link href="/account" className="text-court-700 underline">accountpagina</Link>{" "}
          onder &quot;Vaste speelmomenten&quot;, óf rechtstreeks in de chat:
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {["Zet dinsdag 20:00 als vast moment", "Voeg vrijdag 21:00 toe", "Haal dinsdag weg"].map((v) => (
            <li key={v} className="rounded-md bg-court-50 px-3 py-2 font-mono text-court-900">&quot;{v}&quot;</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600">
          Voor elk moment checkt VrijeBaan ruim na die tijd automatisch of hetzelfde moment volgende week ook vrij
          is, en stuurt je bot dan een berichtje met een link. Het &quot;op de hoogte houden&quot;-vinkje per moment
          zet je vooralsnog alleen op de accountpagina — via de chat toegevoegde momenten staan daar standaard aan.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Daarnaast krijg je automatisch een melding zodra er een nieuwe plek vrijkomt bij een club die je op de{" "}
          <Link href="/radar" className="text-court-700 underline">Radar</Link>{" "}
          volgt (&quot;Volg deze club&quot;) — en dan alleen als het nieuwe slot in de buurt van je voorkeurstijd
          valt (geen voorkeurstijd ingesteld? dan telt elk nieuw slot bij die club). Clubs die je niet volgt leveren
          nooit een melding op, ook niet als ze in je buurt liggen.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">5. Commando&apos;s en veiligheid</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Commando</th>
                <th className="px-4 py-2 font-medium">Doet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="px-4 py-2 font-mono">/help</td><td className="px-4 py-2">Overzicht van alles wat de bot kan</td></tr>
              <tr><td className="px-4 py-2 font-mono">/status</td><td className="px-4 py-2">Je huidige locatie, straal, tijd en vaste speelmomenten</td></tr>
              <tr><td className="px-4 py-2 font-mono">/annuleer</td><td className="px-4 py-2">Stopt een lopende locatiekeuze of zoekopdracht</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Uit veiligheid kan de bot je telefoonnummer niet wijzigen en je account niet verwijderen — dat kan alleen
          via je <Link href="/account" className="text-court-700 underline">Account-pagina</Link>, na inloggen.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">Kort overzicht</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Wat</th>
                <th className="px-4 py-2 font-medium">Waar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-2">Bot koppelen/ontkoppelen</td>
                <td className="px-4 py-2"><Link href="/account" className="text-court-700 underline">Account</Link></td>
              </tr>
              <tr>
                <td className="px-4 py-2">Losse zoekopdracht (&quot;zoek een baan in...&quot;)</td>
                <td className="px-4 py-2">Rechtstreeks in de Telegram-chat</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Straal, tijd en locatie aanpassen</td>
                <td className="px-4 py-2">Account, of rechtstreeks in de Telegram-chat</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Vaste speeldag + -tijd toevoegen/verwijderen</td>
                <td className="px-4 py-2">Account, of rechtstreeks in de Telegram-chat</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Aan/uit-vinkje per vast speelmoment</td>
                <td className="px-4 py-2"><Link href="/account" className="text-court-700 underline">Account</Link></td>
              </tr>
              <tr>
                <td className="px-4 py-2">Club volgen voor meldingen bij nieuwe sloten</td>
                <td className="px-4 py-2"><Link href="/radar" className="text-court-700 underline">Radar</Link></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
