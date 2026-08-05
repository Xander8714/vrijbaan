"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import LocatieKiezer from "@/components/LocatieKiezer";
import type { GevondenLocatie } from "@/lib/geo";
import type { Profiel } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { normaliseerMobielNummer, toonMobielNummer } from "@/lib/telefoon";

/**
 * Eigen gegevens bekijken en bijwerken. De locatie wordt niet als losse
 * tekstregel bewaard maar samen met lat/lon uit PDOK, want daar rekent de
 * Radar-straal op — een woonplaats zonder coördinaat is voor het filteren
 * onbruikbaar.
 */
export default function ProfielFormulier({
  userId,
  email,
  beginProfiel,
}: {
  userId: string;
  // Nodig voor de upsert hieronder — email is NOT NULL zonder default op
  // profiles, dus zonder dit veld faalt een upsert (bv. voor een echt
  // ontbrekende rij) met "null value in column email violates not-null
  // constraint" i.p.v. gewoon de rij aan te maken (4 aug 2026, gevonden bij
  // het testen van de upsert-fix voor vdheuvelx@gmail.com).
  email: string;
  beginProfiel: Profiel;
}) {
  const router = useRouter();
  const [profiel, setProfiel] = useState<Profiel>(beginProfiel);
  const [status, setStatus] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [telefoonInvoer, setTelefoonInvoer] = useState(
    profiel.telefoon ? toonMobielNummer(profiel.telefoon) : ""
  );
  const [telefoonFout, setTelefoonFout] = useState<string | null>(null);

  const zet = <K extends keyof Profiel>(veld: K, waarde: Profiel[K]) =>
    setProfiel((p) => ({ ...p, [veld]: waarde }));

  const werkTelefoonBij = (invoer: string) => {
    setTelefoonInvoer(invoer);
    if (invoer.trim() === "") { setTelefoonFout(null); zet("telefoon", null); return; }
    const genormaliseerd = normaliseerMobielNummer(invoer);
    if (genormaliseerd === null) {
      setTelefoonFout("Dit is geen geldig Nederlands mobiel nummer (bv. 06 12345678 of +31 6 12345678).");
      zet("telefoon", null);
    } else {
      setTelefoonFout(null);
      zet("telefoon", genormaliseerd);
    }
  };

  const kiesLocatie = (loc: GevondenLocatie) => {
    setProfiel((p) => ({
      ...p,
      straat: loc.straatnaam ?? (loc.soort === "weg" ? loc.weergavenaam.split(",")[0] : p.straat),
      postcode: loc.postcode ?? p.postcode,
      woonplaats: loc.woonplaatsnaam ?? p.woonplaats,
      lat: loc.lat,
      lon: loc.lon,
    }));
    setStatus("Locatie gekozen — klik op Opslaan om te bewaren.");
  };

  const opslaan = async () => {
    setFout(null); setStatus(null);
    if (telefoonFout) { setFout("Los eerst het telefoonnummer op, of maak het veld leeg."); return; }
    setBezig(true);
    const supabase = supabaseBrowser();
    // upsert i.p.v. update — Xander (4 aug 2026): een testaccount
    // (vdheuvelx@gmail.com) bleek een auth.users-rij te hebben zonder
    // bijbehorende profiles-rij (de on_auth_user_created-trigger had 'm om
    // onduidelijke reden niet aangemaakt). Met .update() slaagt zo'n opslag
    // stilzwijgend zonder ook maar iets weg te schrijven (0 rijen geraakt,
    // geen foutmelding) — "Gegevens opgeslagen ✓" terwijl er niets
    // opgeslagen is. upsert() maakt de rij alsnog aan als hij ontbreekt, dus
    // stille dataverlies kan hierdoor niet meer.
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email,
        voornaam: profiel.voornaam,
        achternaam: profiel.achternaam,
        // speelsterkte/bondsnummer staan niet meer in het formulier hieronder
        // (Xander, 4 aug 2026: "kan voorlopig eruit ... zie ik in de
        // toekomst pas terugkomen bij bv. zoek padelmaatjes"), maar blijven
        // hier gewoon meegestuurd zodat een al ingevulde waarde (bv. via de
        // oude KNLTB-koppeling) niet per ongeluk wordt overschreven met iets
        // anders — profiel.speelsterkte/bondsnummer veranderen nu simpelweg
        // nooit meer, want er is geen input meer die ze bijwerkt.
        speelsterkte: profiel.speelsterkte,
        speelsterkte_bron: profiel.speelsterkteBron,
        bondsnummer: profiel.bondsnummer,
        telefoon: profiel.telefoon,
        straat: profiel.straat,
        huisnummer: profiel.huisnummer,
        postcode: profiel.postcode,
        woonplaats: profiel.woonplaats,
        lat: profiel.lat,
        lon: profiel.lon,
        zoekstraal_km: profiel.zoekstraalKm,
        lidmaatschappen: profiel.lidmaatschappen,
      });
    setBezig(false);
    if (error) {
      // Ontbrekende kolommen = migratie nog niet gedraaid. Noem het bestand,
      // anders zoekt iemand een bug die er niet is.
      const kolomOntbreekt = /column|schema cache/i.test(error.message);
      setFout(
        kolomOntbreekt
          ? "De database mist nog profielkolommen. Voer de bestanden in supabase/migraties/ uit in de Supabase SQL editor (2026-07-29-... en 2026-07-30-telefoonnummer.sql)."
          : `Opslaan mislukt: ${error.message}`
      );
      return;
    }
    setStatus("Gegevens opgeslagen ✓");
    // Ververst de server-component erboven (account/page.tsx), zodat bv.
    // TelegramKoppelen meteen weet dat er nu een telefoonnummer is — zonder
    // dit blijft die knop tot een handmatige paginaherlaad geblokkeerd staan.
    router.refresh();
  };

  const tekstveld = (
    label: string,
    veld: "voornaam" | "achternaam" | "straat" | "huisnummer" | "postcode" | "woonplaats",
    placeholder = ""
  ) => (
    <div>
      <label className="block text-sm font-medium text-slate-700" htmlFor={`veld-${veld}`}>{label}</label>
      <input
        id={`veld-${veld}`}
        value={profiel[veld] ?? ""}
        onChange={(e) => zet(veld, e.target.value === "" ? null : e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Mijn gegevens</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {tekstveld("Voornaam", "voornaam")}
          {tekstveld("Achternaam", "achternaam")}
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="veld-telefoon">
              Mobiel nummer
            </label>
            <input
              id="veld-telefoon"
              type="tel"
              inputMode="tel"
              value={telefoonInvoer}
              onChange={(e) => werkTelefoonBij(e.target.value)}
              placeholder="06 12345678"
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${telefoonFout ? "border-red-400" : "border-slate-300"}`}
            />
            {/* Oude tekst ("voor toekomstige sms/WhatsApp-meldingen") klopte
                niet meer zodra Telegram-koppelen hier bewust van afhangt —
                Xander (4 aug 2026): "dit moet er ook uit". Nieuwe tekst legt
                uit wat het nummer NU al doet, i.p.v. een belofte voor later. */}
            <p className={`mt-1 text-xs ${telefoonFout ? "text-red-600" : "text-slate-500"}`}>
              {telefoonFout ?? "Nodig om Telegram te koppelen."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Waar zoek je banen?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Typ je woonplaats of postcode. De Radar toont dan alleen clubs binnen je straal — ook in dorpen om je heen.
        </p>
        <div className="mt-3">
          <LocatieKiezer onKies={kiesLocatie} beginwaarde={profiel.woonplaats ?? ""} label="Woonplaats of postcode" />
        </div>
        {profiel.woonplaats && (
          <p className="mt-2 text-sm text-slate-700">
            Gekozen: <span className="font-medium">{profiel.woonplaats}</span>
            {profiel.postcode ? ` (${profiel.postcode})` : ""}
          </p>
        )}
        {/* Straat/huisnummer zijn bewust ondergeschikt — Xander (30 juli 2026):
            "gebruik alleen plaats of postcode, straat is optioneel". Ze doen
            niets voor de straal-berekening (die draait op lat/lon uit de
            zoekactie hierboven), dus dit is puur voor wie het adres exact wil
            vastleggen. */}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
            Straat en huisnummer toevoegen (optioneel)
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {tekstveld("Straat", "straat", "optioneel")}
            {tekstveld("Huisnummer", "huisnummer", "optioneel")}
          </div>
        </details>
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="veld-straal">
            Zoekstraal: {profiel.zoekstraalKm} km
          </label>
          <input
            id="veld-straal"
            type="range" min="1" max="10" step="1"
            value={profiel.zoekstraalKm}
            onChange={(e) => zet("zoekstraalKm", Number(e.target.value))}
            className="mt-2 w-full"
          />
        </div>
        {profiel.lat !== null && profiel.lon !== null ? (
          <p className="mt-2 text-xs text-court-700">
            Middelpunt bekend ({profiel.lat.toFixed(5)}, {profiel.lon.toFixed(5)}) — de straal-filter werkt.
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-700">
            Nog geen middelpunt gekozen. Zoek hierboven een straat of woonplaats, anders kan de Radar niet op afstand filteren.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={opslaan} disabled={bezig}
          className="rounded-md bg-court-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-court-700 disabled:opacity-50">
          {bezig ? "Opslaan…" : "Opslaan"}
        </button>
        {status && <span className="text-sm text-court-700">{status}</span>}
        {fout && <span className="text-sm text-red-600">{fout}</span>}
      </div>
    </div>
  );
}
