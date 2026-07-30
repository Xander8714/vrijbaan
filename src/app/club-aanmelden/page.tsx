"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Clubs kunnen zich hier aanmelden. Wat hier binnenkomt is een AANVRAAG en
 * verschijnt niet in de app: elke aanmelding wordt eerst nagetrokken bij de KvK
 * (commerciële club) of via de verenigingsregistratie (bv. KNLTB-nummer).
 *
 * Waarom dat hard nodig is: de Radar stuurt mensen naar een baan. Een niet
 * gecontroleerde inzending zou betekenen dat iedereen een willekeurig adres als
 * "padelclub" in de app kan zetten — met gebruikers die voor niets ergens
 * heen rijden, of erger. Daarom vraagt dit formulier expliciet om een
 * verifieerbaar registratienummer en zegt het er ook bij dat het gecontroleerd
 * wordt.
 */
export default function ClubAanmeldenPage() {
  const [velden, setVelden] = useState({
    clubnaam: "",
    boekingssysteem: "",
    boekings_url: "",
    straat: "",
    huisnummer: "",
    postcode: "",
    woonplaats: "",
    aantal_banen: "",
    kvk_nummer: "",
    vereniging_registratie: "",
    contact_naam: "",
    contact_email: "",
    contact_telefoon: "",
  });
  const [zonderLidmaatschap, setZonderLidmaatschap] = useState<"ja" | "nee" | "">("");
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState(false);
  const [bezig, setBezig] = useState(false);

  const zet = (veld: keyof typeof velden) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setVelden((v) => ({ ...v, [veld]: e.target.value }));

  const verstuur = async (e: React.FormEvent) => {
    e.preventDefault();
    setFout(null);

    // Zonder verifieerbaar nummer kunnen we niets controleren, dus dan nemen we
    // de aanvraag niet in behandeling — beter hier weigeren dan later een
    // ongecontroleerde club in de app hebben.
    if (!velden.kvk_nummer.trim() && !velden.vereniging_registratie.trim()) {
      setFout("Vul een KvK-nummer of een verenigingsregistratie (bv. KNLTB-nummer) in — zonder dat kunnen we de club niet controleren.");
      return;
    }

    setBezig(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("club_aanmeldingen").insert({
      clubnaam: velden.clubnaam.trim(),
      boekingssysteem: velden.boekingssysteem.trim() || null,
      boekings_url: velden.boekings_url.trim() || null,
      straat: velden.straat.trim() || null,
      huisnummer: velden.huisnummer.trim() || null,
      postcode: velden.postcode.trim() || null,
      woonplaats: velden.woonplaats.trim() || null,
      aantal_banen: velden.aantal_banen ? Number(velden.aantal_banen) : null,
      boekbaar_zonder_lidmaatschap: zonderLidmaatschap === "" ? null : zonderLidmaatschap === "ja",
      kvk_nummer: velden.kvk_nummer.trim() || null,
      vereniging_registratie: velden.vereniging_registratie.trim() || null,
      contact_naam: velden.contact_naam.trim(),
      contact_email: velden.contact_email.trim(),
      contact_telefoon: velden.contact_telefoon.trim() || null,
    });
    setBezig(false);
    if (error) { setFout(`Versturen mislukt: ${error.message}`); return; }
    setGelukt(true);
  };

  const veld = (
    label: string,
    naam: keyof typeof velden,
    opties: { verplicht?: boolean; type?: string; hint?: string; placeholder?: string } = {}
  ) => (
    <div>
      <label className="block text-sm font-medium text-slate-700" htmlFor={`veld-${naam}`}>
        {label}{opties.verplicht ? " *" : ""}
      </label>
      <input id={`veld-${naam}`} type={opties.type ?? "text"} required={opties.verplicht}
        value={velden[naam]} onChange={zet(naam)} placeholder={opties.placeholder}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      {opties.hint && <p className="mt-1 text-xs text-slate-500">{opties.hint}</p>}
    </div>
  );

  if (gelukt) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-bold text-slate-900">Bedankt — je aanmelding staat klaar</h1>
        <p className="mt-3 text-slate-600">
          We trekken de gegevens eerst na bij de KvK of de sportbond. Klopt alles, dan nemen we de club op in de
          Radar en krijg je een bericht op het opgegeven e-mailadres. Dit gebeurt niet automatisch — er kijkt
          altijd iemand naar.
        </p>
        <Link href="/radar" className="mt-6 inline-block rounded-md bg-court-600 px-4 py-2 text-sm font-medium text-white hover:bg-court-700">
          Naar de Radar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Je club aanmelden</h1>
      <p className="mt-2 text-slate-600">
        Baan- of clubeigenaar? Meld je club aan en spelers in jouw omgeving vinden je vrije banen terug in
        VrijBaan. Aanmelden is gratis.
      </p>
      <p className="mt-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>We controleren elke aanmelding.</strong> Voordat een club in de app komt, checken we de
        KvK-inschrijving of de registratie bij de sportbond. Aanmeldingen zonder verifieerbaar nummer nemen we
        niet in behandeling.
      </p>

      <form onSubmit={verstuur} className="mt-8 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">De club</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {veld("Clubnaam", "clubnaam", { verplicht: true })}
            {veld("Aantal padelbanen", "aantal_banen", { type: "number" })}
            {veld("Straat", "straat")}
            {veld("Huisnummer", "huisnummer")}
            {veld("Postcode", "postcode", { placeholder: "1234 AB" })}
            {veld("Woonplaats", "woonplaats")}
            {veld("Boekingssysteem", "boekingssysteem", {
              placeholder: "Playtomic, Meet & Play, Foys, eigen systeem…",
              hint: "Hiermee kunnen we je vrije banen automatisch ophalen.",
            })}
            {veld("Link naar jullie boekingspagina", "boekings_url", { type: "url", placeholder: "https://…" })}
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700" htmlFor="lidmaatschap">
              Kan iemand zonder lidmaatschap bij jullie een baan boeken?
            </label>
            <select id="lidmaatschap" value={zonderLidmaatschap}
              onChange={(e) => setZonderLidmaatschap(e.target.value as "ja" | "nee" | "")}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">— kies —</option>
              <option value="ja">Ja, iedereen kan boeken</option>
              <option value="nee">Nee, alleen leden</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Clubs waar alleen leden kunnen boeken tonen we niet: onze gebruikers zoeken een baan die ze
              vandaag kunnen reserveren.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Verificatie</h2>
          <p className="mt-1 text-sm text-slate-600">Vul minstens één van deze twee in.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {veld("KvK-nummer", "kvk_nummer", { hint: "Voor commerciële clubs." })}
            {veld("Verenigingsregistratie", "vereniging_registratie", { hint: "Bv. je KNLTB-verenigingsnummer." })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Contactpersoon</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {veld("Naam", "contact_naam", { verplicht: true })}
            {veld("E-mailadres", "contact_email", { verplicht: true, type: "email" })}
            {veld("Telefoonnummer", "contact_telefoon", { type: "tel" })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Deze gegevens gebruiken we alleen om over de aanmelding te overleggen; ze komen niet in de app.
          </p>
        </section>

        {fout && <p className="text-sm text-red-600">{fout}</p>}

        <button type="submit" disabled={bezig}
          className="rounded-md bg-court-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-court-700 disabled:opacity-50">
          {bezig ? "Versturen…" : "Aanmelding versturen"}
        </button>
      </form>
    </main>
  );
}
