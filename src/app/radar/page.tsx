"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CLUBS, LEDEN_CLUBS } from "@/lib/clubs";
import { supabaseBrowser } from "@/lib/supabase/client";
import LocatieKiezer from "@/components/LocatieKiezer";
import { afgerondeAfstand, type GevondenLocatie } from "@/lib/geo";
import { begrensZoekstraalVoorDatum, binnenTijdvenster, dagLabel, halfUurOpties, komendeDagen, MAX_DAGEN_VOORUIT_ZOEKEN, naarMinuten, rondAfOpHalfUur } from "@/lib/tijd";
import { boekingsBestemming } from "@/lib/boekingsLink";
import { leesJsonRespons } from "@/lib/jsonResponse";
import type { Club } from "@/lib/types";
import { BalIcon } from "@/components/PadelIcons";

// Zoveel tijden tonen we standaard per club — meer verbergen we achter een
// "Toon alle"-knop. Xander (29 juli 2026): "max 5 tijden tonen ipv alles" —
// bij een populaire club met 20+ vrije tijden maakte de volle lijst de
// pagina onoverzichtelijk op mobiel.
const MAX_TIJDEN_ZICHTBAAR = 5;

// Voor de melding zolang er nog geen zoekgebied gekozen is (zie onder) —
// zelfde rekenpatroon als TOTAAL_BANEN op de homepage.
const TOTAAL_BANEN_LANDELIJK = CLUBS.reduce((som, club) => som + club.banen, 0);

const GRATIS_LIMIET = 1;
const OPSLAG_SLEUTEL = "vrijbaan-zoekgebied";
const MARGE_OPTIES = [1, 2, 3];

// Totaal aantal clubs dat één zoekactie mag tonen. De API wordt hieronder in
// kleinere reeksen aangeroepen, zodat elke losse aanvraag onder de proxytimeout
// blijft en resultaten geleidelijk binnenkomen.
const MAX_ZICHTBAAR = 20;
const API_BATCH_GROOTTE = 4;

type Slot = { tijd: string; prijs: string | null };
type Meting = { sloten: Slot[]; fout?: string };
type Zoekgebied = { lat: number; lon: number; plaatsnaam: string; straalKm: number };
type BeschikbaarheidRespons = {
  beschikbaarheid: { clubId: string; sloten: Slot[]; fout?: string }[];
  opgehaaldOp?: string;
};

export default function RadarPage() {
  const [gevolgd, setGevolgd] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [laden, setLaden] = useState(true);
  const [limietMelding, setLimietMelding] = useState(false);
  // Welke club net gedeeld is (voor de "Gekopieerd!"-bevestiging op
  // desktop, waar navigator.share niet bestaat) — zie deelClub.
  const [gedeeld, setGedeeld] = useState<string | null>(null);

  // Metingen per "clubId|datum", opgehaald op aanvraag voor de zichtbare selectie.
  const [metingen, setMetingen] = useState<Map<string, Meting>>(new Map());
  const [metingBezig, setMetingBezig] = useState(false);
  const [metingFout, setMetingFout] = useState<string | null>(null);
  const [opgehaaldOp, setOpgehaaldOp] = useState<string | null>(null);

  // Datum uit een deep link die net buiten het standaard 7-daagse venster
  // valt (bv. de wekelijkse-herinneringslink in Telegram, die altijd exact
  // vandaag+7 dagen linkt — één dag verder dan komendeDagen() standaard
  // toont) — Xander (3 aug 2026): "hij kan niks vinden de 10de", link naar
  // die dag werkte niet omdat de Radar 'm stilzwijgend negeerde. In plaats
  // van het standaardvenster overal op te rekken (kost extra Playwright-
  // runs per bezoek, zie DAGEN_VOORUIT hierboven) breidt dit alleen uit als
  // er ook echt zo'n link gevolgd is.
  const [extraDagUitLink, setExtraDagUitLink] = useState<string | null>(null);
  const dagen = useMemo(() => {
    const zichtbaar = komendeDagen();
    if (extraDagUitLink && !zichtbaar.includes(extraDagUitLink)) return [...zichtbaar, extraDagUitLink].sort();
    return zichtbaar;
  }, [extraDagUitLink]);
  // Standaard actuele tijd ± 2 uur — Xander (30 juli 2026): "pak altijd de
  // actuele tijd, behalve als het later is dan 21 uur, want dan is de
  // persoon op zoek naar de volgende dag". Beide zijn lazy useState-
  // initializers: ze lezen `new Date()` precies één keer, bij het laden van
  // de pagina, niet bij elke render.
  //
  // NA 21:00 (én vóór 07:00, buiten het bereik van halfUurOpties — Xander,
  // 3 aug 2026) blijft voorkeurstijd bewust LEEG i.p.v. de actuele kloktijd —
  // Xander (30 juli 2026): "22:57 als voorkeurstijd voor morgen is zinloos,
  // toon dan de eerste beschikbare tijd". Een lege voorkeurstijd filtert niet
  // en de lijst staat toch al chronologisch, dus de vroegste tijden van
  // morgen staan vanzelf bovenaan — geen aparte "eerste tijd"-logica nodig.
  const nuUur = new Date().getHours();
  const buitenSpeeltijden = nuUur >= 21 || nuUur < 7;
  const [gekozenDatum, setGekozenDatum] = useState(() => (buitenSpeeltijden ? dagen[1] : dagen[0]));
  const [voorkeurstijd, setVoorkeurstijd] = useState(() => {
    if (buitenSpeeltijden) return "";
    const nu = new Date();
    // Afronden op het dichtstbijzijnde halve uur — anders komt hier bv.
    // "14:23" te staan, wat geen optie is in de halfUurOpties()-dropdown en
    // dus als lege selectie zou ogen.
    return rondAfOpHalfUur(`${String(nu.getHours()).padStart(2, "0")}:${String(nu.getMinutes()).padStart(2, "0")}`) ?? "";
  });
  const [margeUren, setMargeUren] = useState(2);

  // Handmatige trigger voor de "Zoek nu"-knop — het effect dat beschikbaarheid
  // ophaalt reageert normaal alleen op wijzigingen in club-selectie/datum, dus
  // nogmaals klikken bij ONgewijzigde filters deed zichtbaar niets. Xander
  // (2 aug 2026): "een knop 'zoek nu' zodat je zeker weet dat die daadwerkelijk
  // gaat zoeken". Een oplopende teller in de dependency-array forceert een
  // nieuwe ronde, ook als er verder niets veranderd is.
  const [handmatigeZoekopdracht, setHandmatigeZoekopdracht] = useState(0);

  const [zoekgebied, setZoekgebied] = useState<Zoekgebied | null>(null);
  const [straalKm, setStraalKm] = useState(10);
  const [bewaarStatus, setBewaarStatus] = useState<string | null>(null);
  const [locatieBezig, setLocatieBezig] = useState(false);
  const [locatieFout, setLocatieFout] = useState<string | null>(null);

  // Eigen gegevens, alleen om te kunnen laten kopiëren bij het boeken —
  // meesturen naar de site van de club kan een webpagina niet (same-origin).
  const [eigenGegevens, setEigenGegevens] = useState<{ naam: string; email: string } | null>(null);
  const [boeking, setBoeking] = useState<{ club: Club; tijd: string; gekopieerd: boolean } | null>(null);
  const [uitgeklapt, setUitgeklapt] = useState<Set<string>>(new Set());

  const wisselUitklap = (clubId: string) => {
    setUitgeklapt((vorige) => {
      const nieuw = new Set(vorige);
      if (nieuw.has(clubId)) nieuw.delete(clubId); else nieuw.add(clubId);
      return nieuw;
    });
  };

  /**
   * Locatie bepalen zonder externe dienst of API-key: de Geolocation API van
   * de browser zelf (een webstandaard, vraagt de gebruiker om toestemming) en
   * PDOK om er een plaatsnaam bij te zoeken. Geen IP-lookup-dienst van derden,
   * dus er gaat geen verzoek met het IP van de gebruiker naar een tracker.
   *
   * enableHighAccuracy staat bewust UIT: we willen een globale plek om een
   * straal vanaf te rekenen, geen exacte positie — dat is sneller, spaart accu
   * en is privacyvriendelijker.
   *
   * Staat bewust VÓÓR de init-useEffect hieronder (i.p.v. bij de andere
   * locatiefuncties verderop): die effect roept 'm automatisch aan als er nog
   * geen locatie bekend is, en een const-functie moet al gedeclareerd zijn
   * vóór een eerdere closure 'm mag gebruiken (geen hoisting bij const).
   */
  const gebruikMijnLocatie = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocatieFout("Je browser ondersteunt automatische locatiebepaling niet. Zoek hierboven je plaats op.");
      return;
    }
    setLocatieBezig(true);
    setLocatieFout(null);
    navigator.geolocation.getCurrentPosition(
      async (positie) => {
        const { latitude, longitude } = positie.coords;
        let plaatsnaam = "je huidige omgeving";
        try {
          const res = await fetch(`/api/plaatsen-in-buurt?lat=${latitude}&lon=${longitude}&straal=30`);
          const data = await res.json();
          if (res.ok && data.plaatsen?.length > 0) plaatsnaam = data.plaatsen[0].woonplaatsnaam;
        } catch {
          // Zonder naam is de locatie nog steeds bruikbaar om op te rekenen.
        }
        const nieuw: Zoekgebied = { lat: latitude, lon: longitude, plaatsnaam, straalKm };
        setZoekgebied(nieuw);
        window.localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(nieuw));
        setLocatieBezig(false);
      },
      (fout) => {
        setLocatieFout(
          fout.code === fout.PERMISSION_DENIED
            ? "Je hebt geen toestemming gegeven. Zoek hierboven je plaats op."
            : "Je locatie kon niet bepaald worden. Zoek hierboven je plaats op."
        );
        setLocatieBezig(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  };

  useEffect(() => {
    // Alles wordt hier ná een await gezet: het profiel in de database gaat vóór
    // de lokale opslag, dus we moeten eerst weten of er een sessie is voordat
    // we iets in de state zetten. (Scheelt ook een cascading render — zie de
    // react-hooks/set-state-in-effect regel.)
    const init = async () => {
      // Query-params vanuit een gedeelde link (bv. de Telegram-bot) winnen van
      // opgeslagen/automatische locatie — wie een link met een specifieke
      // plaats+tijd volgt, wil precies dat zien. 2 aug 2026: nodig zodra
      // botlinks naar /radar?lat=..&lon=..&plaats=..&straal=..&tijd=.. wijzen,
      // zodat boekingslinks via de site lopen i.p.v. rechtstreeks naar de club.
      const urlParams = new URLSearchParams(window.location.search);
      const urlLat = Number(urlParams.get("lat"));
      const urlLon = Number(urlParams.get("lon"));
      const uitUrl: Zoekgebied | null =
        Number.isFinite(urlLat) && Number.isFinite(urlLon) && urlParams.has("lat") && urlParams.has("lon")
          ? {
              lat: urlLat,
              lon: urlLon,
              plaatsnaam: urlParams.get("plaats") ?? "de gekozen locatie",
              straalKm: Number(urlParams.get("straal")) || 10,
            }
          : null;
      const urlTijd = urlParams.get("tijd");
      if (urlTijd && naarMinuten(urlTijd) !== null) setVoorkeurstijd(urlTijd);
      // Binnen het standaardvenster: direct overnemen. Net erbuiten (bv. de
      // wekelijkse-herinneringslink op precies +7 dagen): erbij zetten i.p.v.
      // de link stilzwijgend te negeren — zie extraDagUitLink hierboven. Ver
      // erbuiten (ongeldige/verzonnen datum): negeren, niet blind vertrouwen.
      const urlDatum = urlParams.get("datum");
      if (urlDatum && dagen.includes(urlDatum)) {
        setGekozenDatum(urlDatum);
      } else if (urlDatum && komendeDagen(MAX_DAGEN_VOORUIT_ZOEKEN + 1).includes(urlDatum)) {
        // +1: MAX_DAGEN_VOORUIT_ZOEKEN betekent "dag+N mag nog", dus de lijst
        // moet N+1 lang zijn om dag N zelf te bevatten (zie tijd.ts).
        setExtraDagUitLink(urlDatum);
        setGekozenDatum(urlDatum);
      }

      let uitOpslag: Zoekgebied | null = null;
      const lokaal = window.localStorage.getItem(OPSLAG_SLEUTEL);
      if (lokaal) {
        try {
          uitOpslag = JSON.parse(lokaal) as Zoekgebied;
        } catch {
          // Onleesbare opslag negeren; niet de pagina laten struikelen.
        }
      }

      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

      if (!user) {
        // Xander (30 juli 2026): "de locatie ±10km als iemand online komt,
        // zodat de banen al geladen worden ipv wachten" — bewust NIET
        // awaiten: dit start de (async) browser-geolocatie op de achtergrond,
        // de rest van de pagina hoeft daar niet op te wachten. Alleen als er
        // nog geen locatie bekend is; een bewaard zoekgebied wint altijd.
        const eersteKeus = uitUrl ?? uitOpslag;
        if (eersteKeus) { setZoekgebied(eersteKeus); setStraalKm(eersteKeus.straalKm); }
        else gebruikMijnLocatie();
        // Vanuit een botlink (lat/lon in de URL) wil je niet nogmaals zelf op
        // "Zoek nu" hoeven klikken — Xander (3 aug 2026): "als ik vanuit
        // telegram kom wil ik dat je direct op zoek nu klikt". Bij een gewoon
        // paginabezoek (geen URL-locatie) blijft handmatig zoeken de regel,
        // zie de toelichting bij het ophaal-effect hieronder.
        if (uitUrl) setHandmatigeZoekopdracht((n) => n + 1);
        setLaden(false);
        return;
      }

      setUserId(user.id);
      const [{ data: clubs }, { data: profiel }] = await Promise.all([
        supabase.from("gevolgde_clubs").select("club_id").eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("subscription_status, woonplaats, lat, lon, zoekstraal_km, voornaam, achternaam")
          .eq("id", user.id)
          .single(),
      ]);
      setGevolgd(new Set((clubs ?? []).map((r) => r.club_id)));
      setIsPro(profiel?.subscription_status === "pro");
      const naam = [profiel?.voornaam, profiel?.achternaam].filter(Boolean).join(" ");
      if (naam || user.email) setEigenGegevens({ naam, email: user.email ?? "" });
      const uitProfiel: Zoekgebied | null =
        profiel?.lat != null && profiel?.lon != null
          ? {
              lat: profiel.lat,
              lon: profiel.lon,
              plaatsnaam: profiel.woonplaats ?? "je opgeslagen locatie",
              straalKm: profiel.zoekstraal_km ?? 10,
            }
          : null;
      const gekozen = uitUrl ?? uitProfiel ?? uitOpslag;
      if (gekozen) { setZoekgebied(gekozen); setStraalKm(gekozen.straalKm); }
      else gebruikMijnLocatie(); // idem: automatisch laden i.p.v. wachten op een klik
      // Zelfde botlink-uitzondering als hierboven in de niet-ingelogde tak.
      if (uitUrl) setHandmatigeZoekopdracht((n) => n + 1);
      setLaden(false);
    };

    init().catch(() => setLaden(false));
  }, []);

  // Verenigingen zitten achter hun eigen inlogmuur en hebben daarom geen nut
  // voor het gratis testaccount. Pro-gebruikers kunnen ze wel direct volgen.
  const kandidaatClubs = useMemo(
    () => isPro ? [...CLUBS, ...LEDEN_CLUBS] : CLUBS,
    [isPro]
  );

  const straalVoorDatum = begrensZoekstraalVoorDatum(straalKm, gekozenDatum);
  const straalBegrensdVoorDatum = straalVoorDatum < straalKm;

  /**
   * Op afstand filteren. Dit bepaalt óók welke clubs we live opvragen, dus het
   * moet vóór dat effect staan.
   *
   * Gevolgde clubs vallen NOOIT buiten dit filter, ook al liggen ze verder
   * dan de ingestelde straal — Xander (3 aug 2026): "gevolgde clubs altijd
   * tonen". Een club volgen is een expliciete keuze; die verliezen zodra je
   * straal toevallig kleiner staat zou een melding op de Radar onvindbaar
   * maken.
   */
  const clubsInStraal = useMemo(() => {
    if (!zoekgebied) return kandidaatClubs.map((club) => ({ ...club, afstandKm: null as number | null }));
    return kandidaatClubs
      .map((club) => ({ ...club, afstandKm: afgerondeAfstand({ lat: zoekgebied.lat, lon: zoekgebied.lon }, club) }))
      .filter((club) => club.afstandKm <= straalVoorDatum || gevolgd.has(club.id))
      .sort((a, b) => a.afstandKm - b.afstandKm);
  }, [kandidaatClubs, zoekgebied, straalVoorDatum, gevolgd]);

  /**
   * Zitten er meer dan MAX_ZICHTBAAR clubs in de gekozen straal, dan versmallen
   * we automatisch naar de dichtstbijzijnde MAX_ZICHTBAAR i.p.v. de gebruiker
   * te vragen zelf de straal te verlagen — Xander (4 aug 2026): "dat je het
   * zoekgebied net zo klein instelt als max 20 clubs in de omgeving, als er
   * dan minder zijn toon je wel alles". Gevolgde clubs gaan altijd mee (zie
   * de toelichting bij clubsInStraal hierboven), ook als dat betekent dat er
   * voor de "overige" clubs minder dan MAX_ZICHTBAAR ruimte overblijft.
   * clubsInStraal ligt al gesorteerd op afstand, dus de eerste N niet-
   * gevolgde clubs zijn meteen de dichtstbijzijnde.
   */
  const teVeelInStraal = clubsInStraal.length > MAX_ZICHTBAAR;
  const clubsOmTeTonen = useMemo(() => {
    if (!teVeelInStraal) return clubsInStraal;
    const gevolgdeInStraal = clubsInStraal.filter((c) => gevolgd.has(c.id));
    const overigeInStraal = clubsInStraal.filter((c) => !gevolgd.has(c.id));
    return [...gevolgdeInStraal, ...overigeInStraal].slice(0, MAX_ZICHTBAAR);
  }, [clubsInStraal, teVeelInStraal, gevolgd]);
  // Straal die daadwerkelijk gebruikt is na het versmallen — alleen over de
  // niet-gevolgde clubs, want gevolgde clubs mogen buiten dat bereik liggen
  // zonder de gemelde straal op te rekken.
  const effectieveStraalKm = teVeelInStraal
    ? Math.round(Math.max(0, ...clubsOmTeTonen.filter((c) => !gevolgd.has(c.id)).map((c) => c.afstandKm ?? 0)))
    : straalVoorDatum;

  /**
   * Beschikbaarheid halen we op voor precies clubsOmTeTonen, niet voor alle
   * 111 gekoppelde clubs. Reden: Playtomic en Meet & Play kosten elk een
   * Playwright-run van ~15-20 seconden per club, dus "alles ophalen" duurt
   * ruim een uur. clubsOmTeTonen is al begrensd tot MAX_ZICHTBAAR (zie
   * hierboven), dus hier hoeft niet nogmaals op een bovengrens gecheckt te
   * worden.
   *
   * BEWUST NIET automatisch bij laden of bij elke filterwijziging — Xander
   * (2 aug 2026): "die 'bezig met zoeken' zodra de site geopend wordt werkt
   * mij ook tegen, dat moet eruit, pas zoeken op het moment van knop
   * drukken". `handmatigeZoekopdracht` is daarom de ENIGE trigger: die staat
   * op 0 tot de eerste klik op "Zoek nu", dus zowel het laden van de pagina
   * als het wisselen van dag/straal/locatie doet op zichzelf niets meer —
   * pas een nieuwe klik haalt verse data op. clubsOmTeTonen/gekozenDatum
   * staan bewust NIET in de dependency-array (ze worden wél gelezen, via de
   * closure van het moment van de klik): ze mogen het effect niet opnieuw
   * laten afgaan, alleen de knop mag dat.
   */
  // Ref (niet state) omdat de AbortController zelf geen render hoeft te
  // triggeren — alleen breekZoekenAf() en het effect hieronder lezen 'm.
  const zoekControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (handmatigeZoekopdracht === 0) return; // nog niet op "Zoek nu" gedrukt

    const ids = clubsOmTeTonen.map((c) => c.id);
    if (ids.length === 0) return;

    // AbortController i.p.v. alleen de bestaande "afgebroken"-vlag (5 aug
    // 2026, Xander: "zorg dat ik het zoeken kan stoppen als ik een fout heb
    // gemaakt") — de oude vlag voorkwam alleen dat een verlate respons de
    // state nog bijwerkte, maar de fetch zelf liep gewoon door tot 'ie klaar
    // was. Nu breekt breekZoekenAf() het verzoek ZELF af (via de ref), niet
    // alleen de reactie erop.
    const controller = new AbortController();
    zoekControllerRef.current = controller;

    const haalOp = async () => {
      // De statuswissel staat binnen deze async functie en niet in de body van
      // het effect, zodat React geen cascading render krijgt
      // (react-hooks/set-state-in-effect).
      setMetingBezig(true);
      setMetingFout(null);
      try {
        for (let i = 0; i < ids.length; i += API_BATCH_GROOTTE) {
          const batchIds = ids.slice(i, i + API_BATCH_GROOTTE);
          const res = await fetch(
            `/api/beschikbaarheid?datum=${gekozenDatum}&clubs=${encodeURIComponent(batchIds.join(","))}`,
            { signal: controller.signal }
          );
          const data = await leesJsonRespons<BeschikbaarheidRespons>(res);
          if (controller.signal.aborted) return;

          const map = new Map<string, Meting>();
          for (const rij of data.beschikbaarheid) {
            map.set(`${rij.clubId}|${gekozenDatum}`, { sloten: rij.sloten, fout: rij.fout });
          }
          setMetingen((vorige) => new Map([...vorige, ...map]));
          setOpgehaaldOp(data.opgehaaldOp ?? null);
        }
        setMetingBezig(false);
      } catch (e) {
        if (controller.signal.aborted) return; // zelf afgebroken — geen foutmelding, dat is geen mislukking
        setMetingFout(e instanceof Error ? e.message : "Ophalen mislukt.");
        setMetingBezig(false);
      }
    };

    haalOp();
    return () => controller.abort();
    // clubsInStraal/gekozenDatum bewust buiten de dependency-array — alleen
    // handmatigeZoekopdracht (de "Zoek nu"-knop) mag dit effect starten, zie
    // de toelichting hierboven. De huidige waarden worden nog wel gebruikt,
    // via de closure van het moment van de klik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handmatigeZoekopdracht]);

  const breekZoekenAf = () => {
    zoekControllerRef.current?.abort();
    setMetingBezig(false);
    setMetingFout(null);
  };


  const kiesLocatie = (loc: GevondenLocatie) => {
    const nieuw: Zoekgebied = { lat: loc.lat, lon: loc.lon, plaatsnaam: loc.woonplaatsnaam ?? loc.weergavenaam, straalKm };
    setZoekgebied(nieuw);
    setBewaarStatus(null);
    window.localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(nieuw));
  };

  const bewaarZoekgebied = async () => {
    if (!zoekgebied) return;
    const teBewaren = { ...zoekgebied, straalKm };
    window.localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(teBewaren));
    if (!userId) { setBewaarStatus("Bewaard op dit apparaat. Log in om het aan je account te koppelen."); return; }
    const supabase = supabaseBrowser();
    const { error } = await supabase
      .from("profiles")
      .update({ lat: teBewaren.lat, lon: teBewaren.lon, woonplaats: teBewaren.plaatsnaam, zoekstraal_km: straalKm })
      .eq("id", userId);
    if (!error) { setBewaarStatus("Zoekgebied opgeslagen in je account ✓"); return; }
    // De meest voorkomende oorzaak is een database waarin de migratie nog niet
    // gedraaid heeft. Dat is een instelfout, geen bug — zeg dus wát er moet
    // gebeuren in plaats van alleen de ruwe Postgres-melding te tonen.
    const kolomOntbreekt = /column|schema cache/i.test(error.message);
    setBewaarStatus(
      kolomOntbreekt
        ? "Bewaard op dit apparaat. Voor opslaan in je account moet supabase/migraties/2026-07-29-profielgegevens-en-clubaanmeldingen.sql nog in Supabase uitgevoerd worden."
        : `Opslaan mislukt: ${error.message}`
    );
  };

  const toggle = async (id: string) => {
    const volgtAl = gevolgd.has(id);
    if (!volgtAl && !isPro && gevolgd.size >= GRATIS_LIMIET) { setLimietMelding(true); return; }
    setLimietMelding(false);
    setGevolgd((prev) => { const next = new Set(prev); if (volgtAl) next.delete(id); else next.add(id); return next; });
    if (!userId) return;
    const supabase = supabaseBrowser();
    if (volgtAl) await supabase.from("gevolgde_clubs").delete().eq("user_id", userId).eq("club_id", id);
    else await supabase.from("gevolgde_clubs").insert({ user_id: userId, club_id: id });
  };

  /**
   * "Deel met je groep" — Xander (3 aug 2026): padellen speel je met z'n
   * vieren, dus een gevonden plek delen met je vaste maatjes is de
   * goedkoopste manier om iemand anders VrijeBaan te laten proberen. Deelt
   * dezelfde zoek-URL als de Telegram-bot al gebruikt (lat/lon/straal/datum/
   * tijd), zodat wie erop klikt precies dezelfde zoekopdracht ziet.
   *
   * navigator.share (mobiel: opent het native deelmenu, rechtstreeks naar
   * WhatsApp e.d.) heeft de voorkeur; zonder die API (vooral desktop) valt
   * dit terug op de tekst naar het klembord kopiëren.
   */
  const deelClub = async (club: Club) => {
    if (!zoekgebied) return;
    const params = new URLSearchParams({
      lat: String(zoekgebied.lat),
      lon: String(zoekgebied.lon),
      plaats: zoekgebied.plaatsnaam,
      straal: String(effectieveStraalKm),
      datum: gekozenDatum,
    });
    if (voorkeurstijd) params.set("tijd", voorkeurstijd);
    const url = `${window.location.origin}/radar?${params.toString()}`;
    const dagIndex = dagen.indexOf(gekozenDatum);
    const tekst = `Kijk of er nog plek is bij ${club.naam} (${dagLabel(gekozenDatum, dagIndex === -1 ? 0 : dagIndex).toLowerCase()}): ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ text: tekst });
      } catch {
        // Gebruiker annuleerde het deelmenu — geen foutmelding nodig.
      }
      return;
    }
    await navigator.clipboard.writeText(tekst);
    setGedeeld(club.id);
    setTimeout(() => setGedeeld((huidig) => (huidig === club.id ? null : huidig)), 2000);
  };

  /**
   * Op een tijd klikken: open de juiste clubpagina (met de datum erin waar dat
   * kan) en kopieer de tijd, zodat de gebruiker die alleen nog hoeft te plakken
   * of te herkennen. De tijd meesturen in de URL kan bij geen enkele aanbieder
   * — zie src/lib/boekingsLink.ts voor wat er per systeem wél mogelijk is.
   */
  const kiesTijd = async (club: Club, tijd: string) => {
    const bestemming = boekingsBestemming(club, gekozenDatum, tijd);
    if (!bestemming) return;

    let gekopieerd = false;
    try {
      await navigator.clipboard.writeText(tijd);
      gekopieerd = true;
    } catch {
      // Klembord kan geweigerd worden (geen https, of geen toestemming). Dan
      // staat de tijd nog steeds in het paneel, dus niets gaat verloren.
    }
    setBoeking({ club, tijd, gekopieerd });
    window.open(bestemming.url, "_blank", "noopener,noreferrer");
  };

  const zichtbareClubs = useMemo(() => {
    return clubsOmTeTonen
      .map((club) => {
        const meting = metingen.get(`${club.id}|${gekozenDatum}`);
        const sloten = meting?.sloten ?? [];
        const passendeTijden = voorkeurstijd
          ? sloten.filter((s) => binnenTijdvenster(s.tijd, voorkeurstijd, margeUren))
          : sloten;
        return { ...club, meting, sloten, passendeTijden };
      })
      // Filteren op voorkeurstijd mag alleen clubs wegstrepen waarvan we
      // écht weten dat ze niets hebben. Een club zonder (geslaagde) meting
      // verbergen zou hem onterecht als "vol" laten lijken.
      //
      // BEWUST OOK niet filteren zolang metingBezig nog aan staat (Xander,
      // 4 aug 2026: "als ik op zoek nu klik dan valt alles weg en de
      // aantallen kloppen niet") — zonder deze voorwaarde verdween elke club
      // zodra ZIJN meting binnenkwam en niets paste, terwijl de rest van de
      // batch nog liep. Dat liet de lijst live krimpen tijdens het laden en
      // het "ophalen bij N clubs"-bericht (dat clubsOmTeTonen.length gebruikt,
      // niet dit gefilterde aantal) niet meer overeenkomen met de zichtbare
      // koptekst. Nu blijft de lijst tijdens het laden stabiel en wordt pas
      // in één keer gefilterd zodra de hele batch klaar is.
      .filter((club) => metingBezig || !voorkeurstijd || !club.meting || club.meting.fout || club.passendeTijden.length > 0);
  }, [clubsOmTeTonen, metingen, gekozenDatum, voorkeurstijd, margeUren, metingBezig]);

  const metPassendeTijd = zichtbareClubs.filter((c) => c.passendeTijden.length > 0).length;

  // Datum bij de resultatentekst (5 aug 2026, Xander: bij een deep link met
  // een datum ver vooruit was nergens te zien vóór welke dag de resultaten
  // eigenlijk golden — verwarrend zodra een club daarna 14+ dagen vooruit
  // boekbaar bleek, zoals bij Playtomic). Zelfde dagLabel-patroon als
  // deelClub hieronder gebruikt voor het deel-bericht.
  const gekozenDagLabel = dagLabel(gekozenDatum, Math.max(0, dagen.indexOf(gekozenDatum))).toLowerCase();

  // Gevolgde clubs krijgen een eigen strook boven de rest (Xander, 4 aug
  // 2026: "maak een strook tussen met gevolgde clubs") — zo hoef je niet
  // door alles heen te scrollen om te zien of je eigen clubs al iets vrij
  // hebben. "Overige clubs" heet alleen zo zodra die strook er ook echt is;
  // zonder gevolgde clubs blijft het gewoon één lijst.
  const gevolgdeClubs = zichtbareClubs.filter((c) => gevolgd.has(c.id));
  const overigeClubs = zichtbareClubs.filter((c) => !gevolgd.has(c.id));

  // Eén kaart-render voor beide stroken (was een enkele .map() met de hele
  // kaart inline) — Xander (4 aug 2026): compactere kaart, "Volg"/"Deel"
  // naast elkaar i.p.v. gestapeld, en "Boek hier" weg (gaat al via de groene
  // tijd-knoppen). De "Naar de clubsite →"-link voor ledenclubs blijft wél
  // staan: daar is géén groene knop-route, boeken kan alleen via de club
  // zelf.
  const renderKaart = (club: (typeof zichtbareClubs)[number]) => {
    const isGevolgd = gevolgd.has(club.id);
    const isLedenClub = club.boekbaarZonderLidmaatschap === false;
    const clubsiteUrl = isLedenClub ? club.websiteUrl ?? club.boekingsUrl : null;

    return (
      <div key={club.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{club.naam}</p>
            <p className="text-sm text-slate-500">
              {club.plaats} · {club.banen > 0 ? `${club.banen} banen · ` : ""}{club.systeem}
              {club.afstandKm !== null && (
                <>
                  {" · "}
                  <span className="font-medium text-slate-700">{club.afstandKm} km</span>
                  {club.coordinaatBron === "woonplaats" && (
                    <span className="text-slate-400" title="Afstand tot het midden van de plaats, niet tot het exacte clubadres"> (ca.)</span>
                  )}
                </>
              )}
            </p>
            {club.adres && <p className="text-xs text-slate-400">{club.adres}</p>}
            {club.boekbaarZonderLidmaatschap === null && (
              <p className="mt-1 text-xs text-amber-700">
                Vereniging — of je hier als niet-lid kunt boeken is nog niet nagegaan.
              </p>
            )}
            {club.meting?.fout && <p className="mt-1 text-xs text-amber-700">{club.meting.fout}</p>}
          </div>
          {clubsiteUrl && (
            <a
              href={clubsiteUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs font-medium text-court-700 underline"
            >
              Naar de clubsite →
            </a>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => toggle(club.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${isGevolgd ? "bg-court-600 text-white hover:bg-court-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {isGevolgd ? "Wordt gevolgd ✓" : "Volg deze club"}
          </button>
          <button onClick={() => deelClub(club)} disabled={!zoekgebied}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M12 16V4M12 4 7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {gedeeld === club.id ? "Gekopieerd ✓" : "Deel met je groep"}
          </button>
        </div>

        {/* Vrije tijden zelf tonen, niet alleen het aantal — PROJECTPLAN.md §3. */}
        {club.meting && !club.meting.fout && (
          <div className="mt-2 border-t border-slate-100 pt-2">
            {club.sloten.length > 0 ? (() => {
              const open = uitgeklapt.has(club.id);
              // Bij een voorkeurstijd eerst de matchende tijden tonen, dan de
              // rest erachteraan — anders kon de standaardweergave (eerste 5)
              // volledig uit niet-matchende tijden bestaan terwijl de
              // gezochte tijd pas achter "Toon nog N tijden" zat.
              const gesorteerd = voorkeurstijd
                ? [...club.sloten].sort((a, b) => {
                    const aPast = binnenTijdvenster(a.tijd, voorkeurstijd, margeUren) ? 0 : 1;
                    const bPast = binnenTijdvenster(b.tijd, voorkeurstijd, margeUren) ? 0 : 1;
                    return aPast - bPast || a.tijd.localeCompare(b.tijd);
                  })
                : club.sloten;
              const teTonen = open ? gesorteerd : gesorteerd.slice(0, MAX_TIJDEN_ZICHTBAAR);
              const verborgen = club.sloten.length - teTonen.length;
              // Losse knop-render, gedeeld tussen de "past bij je voorkeur"-
              // en de "overige tijden"-groep hieronder.
              const slotKnop = (slot: Slot, past: boolean) => (
                <li key={slot.tijd}>
                  <button
                    type="button"
                    onClick={() => kiesTijd(club, slot.tijd)}
                    title={`Boek ${slot.tijd} bij ${club.naam}${slot.prijs ? ` (${slot.prijs})` : ""}`}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition hover:ring-2 hover:ring-court-400 ${
                      past ? "bg-court-100 text-court-900" : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    {slot.tijd}
                    {slot.prijs && <span className="ml-1 opacity-70">· {slot.prijs}</span>}
                  </button>
                </li>
              );

              // Met een voorkeurstijd: twee losse, gelabelde groepen i.p.v.
              // één lijst met alleen een kleurverschil — Xander (2 aug
              // 2026): "een scheiding tussen voorkeurstijd groen en
              // daaronder overige beschikbare tijden grijs". De
              // matchende tijden staan altijd volledig (meestal maar een
              // paar); "Toon nog N" geldt alleen voor de overige groep.
              if (voorkeurstijd) {
                const passend = gesorteerd.filter((s) => binnenTijdvenster(s.tijd, voorkeurstijd, margeUren));
                const overig = gesorteerd.filter((s) => !binnenTijdvenster(s.tijd, voorkeurstijd, margeUren));
                const overigTeTonen = open ? overig : overig.slice(0, MAX_TIJDEN_ZICHTBAAR);
                const overigVerborgen = overig.length - overigTeTonen.length;
                return (
                  <>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <BalIcon className="h-3.5 w-3.5" />
                      {club.sloten.length} vrije {club.sloten.length === 1 ? "tijd" : "tijden"}
                    </p>
                    {passend.length > 0 && (
                      <>
                        <p className="mt-2 text-xs font-medium text-court-700">
                          Past bij {voorkeurstijd} (± {margeUren} uur)
                        </p>
                        <ul className="mt-1 flex flex-wrap gap-1.5">{passend.map((s) => slotKnop(s, true))}</ul>
                      </>
                    )}
                    {overig.length > 0 && (
                      <>
                        <p className="mt-3 text-xs font-medium text-slate-500">Overige tijden</p>
                        <ul className="mt-1 flex flex-wrap gap-1.5">{overigTeTonen.map((s) => slotKnop(s, false))}</ul>
                        {overigVerborgen > 0 && (
                          <button type="button" onClick={() => wisselUitklap(club.id)}
                            className="mt-1.5 text-xs font-medium text-court-700 hover:underline">
                            + Toon nog {overigVerborgen} {overigVerborgen === 1 ? "tijd" : "tijden"}
                          </button>
                        )}
                        {open && overig.length > MAX_TIJDEN_ZICHTBAAR && (
                          <button type="button" onClick={() => wisselUitklap(club.id)}
                            className="mt-1.5 text-xs font-medium text-court-700 hover:underline">
                            Toon minder
                          </button>
                        )}
                      </>
                    )}
                    <p className="mt-2 text-xs text-slate-400">Klik op een tijd om naar de boekingspagina te gaan.</p>
                  </>
                );
              }

              // Geen voorkeurstijd: gewoon één platte lijst.
              return (
                <>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <BalIcon className="h-3.5 w-3.5" />
                    {club.sloten.length} vrije {club.sloten.length === 1 ? "tijd" : "tijden"}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">{teTonen.map((s) => slotKnop(s, true))}</ul>
                  {verborgen > 0 && (
                    <button
                      type="button"
                      onClick={() => wisselUitklap(club.id)}
                      className="mt-1.5 text-xs font-medium text-court-700 hover:underline"
                    >
                      + Toon nog {verborgen} {verborgen === 1 ? "tijd" : "tijden"}
                    </button>
                  )}
                  {open && club.sloten.length > MAX_TIJDEN_ZICHTBAAR && (
                    <button
                      type="button"
                      onClick={() => wisselUitklap(club.id)}
                      className="mt-1.5 text-xs font-medium text-court-700 hover:underline"
                    >
                      Toon minder
                    </button>
                  )}
                  <p className="mt-1 text-xs text-slate-400">Klik op een tijd om naar de boekingspagina te gaan.</p>
                </>
              );
            })() : (
              <p className="text-xs text-slate-500">Geen vrije tijden op deze dag.</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Buiten <main> als volle-breedte sibling (zelfde patroon als de
          homepage-hero in src/app/page.tsx) — Xander (4 aug 2026): "hele
          breedte voor de banner ... niet 75%". <main> hieronder heeft zelf
          max-w-3xl, dus een kind daarvan kan nooit breder dan dat worden;
          dit blok zit er expres vóór, op main-niveau, zodat het de volle
          paginabreedte pakt. Geen pt-* op <main>: dat liet een lichte streep
          zien tussen de donkere nav en dit blok (screenshot) — nu loopt de
          donkere achtergrond door vanaf het menu, met de afgeronde hoeken
          alleen onderaan (rounded-b-2xl). */}
      <div className="baan-hero rounded-b-2xl py-10">
        <div className="mx-auto max-w-3xl px-6 sm:px-8">
          <h1 className="text-3xl font-bold text-white">Beschikbaarheid Radar</h1>
          <p className="mt-2 text-slate-300">
            Kies waar je woont, stel je straal in en kijk tot een week vooruit. Volg een club en krijg een melding
            zodra er een baan vrijkomt.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 pb-12">
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900">Mijn zoekgebied</h2>
        <div className="mt-3">
          <LocatieKiezer onKies={kiesLocatie} beginwaarde={zoekgebied?.plaatsnaam ?? ""} />
        </div>

        <div className="mt-3">
          <button type="button" onClick={gebruikMijnLocatie} disabled={locatieBezig}
            className="rounded-md border border-court-300 bg-court-50 px-3 py-2 text-sm font-medium text-court-800 hover:bg-court-100 disabled:opacity-50">
            {locatieBezig ? "Locatie bepalen…" : "📍 Gebruik mijn locatie"}
          </button>
          <span className="ml-2 text-xs text-slate-400">Bij benadering, via je browser — je locatie gaat niet naar derden.</span>
          {locatieFout && <p className="mt-1 text-xs text-red-600">{locatieFout}</p>}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="straal">
            Straal: {straalKm} km {zoekgebied ? `rond ${zoekgebied.plaatsnaam}` : ""}
          </label>
          <input id="straal" type="range" min="1" max="25" step="1" value={straalKm}
            onChange={(e) => setStraalKm(Number(e.target.value))} className="mt-2 w-full" />
          <div className="flex justify-between text-xs text-slate-400"><span>1 km</span><span>25 km</span></div>
          {/* Xander (4 aug 2026): "geef ergens een tip hoe minder clubs hoe
              sneller de banen geladen worden" — hier, direct bij de knop die
              dat aantal bepaalt, is nuttiger dan pas bij de resultaten. */}
          <p className="mt-2 text-xs text-slate-400">
            Tip: hoe kleiner de straal, hoe minder clubs we hoeven te bevragen — en hoe sneller je de vrije tijden ziet.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={bewaarZoekgebied} disabled={!zoekgebied}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
            Bewaar zoekgebied
          </button>
          {bewaarStatus && <span className="text-xs text-slate-500">{bewaarStatus}</span>}
        </div>
      </section>

      {/* Wanneer wil je spelen? */}
      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Wanneer wil je spelen?</h2>
          {/* Expliciete trigger i.p.v. alleen automatisch verversen — zichtbare
              feedback (spinner-tekst + disabled) zodat een klik voelbaar iets
              doet, ook als de filters ongewijzigd zijn. */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHandmatigeZoekopdracht((n) => n + 1)}
              disabled={metingBezig}
              className="rounded-md bg-court-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-court-700 disabled:opacity-60"
            >
              {metingBezig ? "Bezig met zoeken…" : "🔍 Zoek nu"}
            </button>
            {/* Stop-knop (5 aug 2026, Xander: "zorg dat ik het zoeken kan
                stoppen als ik een fout heb gemaakt") — breekt zowel het
                lopende fetch-verzoek af (via breekZoekenAf/AbortController)
                als de "bezig"-status, zodat een verkeerde straal/locatie/dag
                niet eerst uitgezocht hoeft te worden. */}
            {metingBezig && (
              <button
                type="button"
                onClick={breekZoekenAf}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                ✕ Stop
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {dagen.map((datum, i) => (
            <button key={datum} onClick={() => setGekozenDatum(datum)}
              aria-pressed={gekozenDatum === datum}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                gekozenDatum === datum ? "bg-court-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}>
              {dagLabel(datum, i)}
            </button>
          ))}
        </div>

        {straalBegrensdVoorDatum && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Voor een datum verder dan drie dagen zoekt de Radar maximaal {straalVoorDatum} km rondom je locatie.
            Zo blijft live ophalen betrouwbaar; je opgeslagen straal van {straalKm} km verandert niet.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="voorkeurstijd">Voorkeurstijd</label>
            <select id="voorkeurstijd" value={voorkeurstijd}
              onChange={(e) => setVoorkeurstijd(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Geen voorkeur</option>
              {halfUurOpties().map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="marge">Marge</label>
            <select id="marge" value={margeUren} onChange={(e) => setMargeUren(Number(e.target.value))}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm">
              {MARGE_OPTIES.map((u) => (<option key={u} value={u}>± {u} uur</option>))}
            </select>
          </div>
          {voorkeurstijd && (
            <button onClick={() => setVoorkeurstijd("")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Filter wissen
            </button>
          )}
        </div>

        {/* Drie standen — Xander (2 aug 2026): (1) nog nooit gezocht (sinds
            zoeken niet meer automatisch gebeurt) mag niet als "geen match"
            ogen, (2) tijdens het zoeken evenmin ("geen enkele club" verscheen
            eerder al tíjdens het ophalen, terwijl er na afloop wél 13 vrije
            banen bleken te zijn), (3) pas na afloop het echte resultaat. */}
        {voorkeurstijd && handmatigeZoekopdracht === 0 && (
          <p className="mt-3 text-sm text-slate-500">
            Klik op &quot;Zoek nu&quot; hierboven om te zoeken naar een vrije baan rond {voorkeurstijd} op {gekozenDagLabel}.
          </p>
        )}
        {voorkeurstijd && handmatigeZoekopdracht > 0 && metingBezig && (
          <p className="mt-3 text-sm text-slate-500">Nog aan het zoeken naar een vrije baan rond {voorkeurstijd} op {gekozenDagLabel}…</p>
        )}
        {voorkeurstijd && handmatigeZoekopdracht > 0 && !metingBezig && (
          <p className="mt-3 text-sm text-slate-600">
            {metPassendeTijd > 0
              ? `${metPassendeTijd} club(s) met een vrije baan rond ${voorkeurstijd} (± ${margeUren} uur) op ${gekozenDagLabel}.`
              : `Geen enkele gemeten club heeft een vrije baan rond ${voorkeurstijd} (± ${margeUren} uur) op ${gekozenDagLabel}.`}
          </p>
        )}
      </section>

      {/* Paneel na het klikken op een tijd: wat je op de site van de club nog
          zelf moet doen. Voorinvullen kán niet — de browser staat niet toe dat
          wij een formulier op een ander domein vullen. Daarom laten we het hier
          klaarstaan om te kopiëren. */}
      {boeking && (() => {
        const bestemming = boekingsBestemming(boeking.club, gekozenDatum, boeking.tijd);
        if (!bestemming) return null;
        return (
          <div className="mt-4 rounded-lg border border-court-200 bg-court-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-court-900">
                  {boeking.tijd} bij {boeking.club.naam}
                </p>
                <p className="mt-1 text-sm text-court-800">
                  De boekingspagina is in een nieuw tabblad geopend
                  {bestemming.datumInUrl ? " op de juiste datum" : ""}.
                  {boeking.gekopieerd ? " De tijd staat op je klembord." : ""}
                </p>
                <p className="mt-2 text-sm text-court-900">Daar nog zelf doen:</p>
                <ul className="mt-1 list-inside list-disc text-sm text-court-800">
                  {bestemming.nogZelfDoen.map((stap) => (<li key={stap}>{stap}</li>))}
                </ul>
                {eigenGegevens && (
                  <p className="mt-2 text-xs text-court-700">
                    Je gegevens om in te vullen: <strong>{eigenGegevens.naam || "—"}</strong>
                    {eigenGegevens.email ? ` · ${eigenGegevens.email}` : ""}
                    <span className="text-court-600">
                      {" "}— die kunnen we niet automatisch invullen op de site van de club (dat blokkeert je
                      browser tussen websites).
                    </span>
                  </p>
                )}
                <a href={bestemming.url} target="_blank" rel="noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-court-800 underline">
                  Tabblad niet geopend? Klik hier →
                </a>
              </div>
              <button onClick={() => setBoeking(null)} aria-label="Sluiten"
                className="shrink-0 text-court-700 hover:text-court-900">✕</button>
            </div>
          </div>
        );
      })()}

      {!userId && !laden && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Je bent niet ingelogd — je keuzes worden alleen op dit apparaat bewaard.{" "}
          <Link href="/login" className="font-medium underline">Log in</Link> om ze aan je account te koppelen.
        </p>
      )}
      {userId && !isPro && (
        <p className="mt-4 rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-600">
          Gratis account: je kunt {GRATIS_LIMIET} club volgen ({gevolgd.size}/{GRATIS_LIMIET} gebruikt).{" "}
          <Link href="/pricing" className="font-medium text-court-700 underline">Upgrade naar Pro</Link> voor alle clubs.
        </p>
      )}
      {limietMelding && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          Je hebt je gratis limiet van {GRATIS_LIMIET} club bereikt.{" "}
          <Link href="/pricing" className="font-medium underline">Upgrade naar Pro</Link>.
        </p>
      )}

      {zoekgebied ? (
        <>
          <h2 className="mt-8 font-semibold text-slate-900">
            {zichtbareClubs.length} {zichtbareClubs.length === 1 ? "club" : "clubs"} binnen {straalKm} km
          </h2>

          {/* Automatisch versmald naar de dichtstbijzijnde MAX_ZICHTBAAR i.p.v.
              een vraag om zelf de straal te verlagen — zie de toelichting bij
              clubsOmTeTonen hierboven. */}
          {teVeelInStraal && (
            <div className="mt-3 rounded-md bg-court-50 px-4 py-3 text-sm text-court-900">
              Er zijn {clubsInStraal.length} clubs binnen {straalKm} km — we tonen de {MAX_ZICHTBAAR} dichtstbijzijnde
              (tot ongeveer {effectieveStraalKm} km). Zet de straal lager voor een preciezere selectie.
            </div>
          )}

          {/* Zoeken gebeurt niet meer automatisch (zie de toelichting bij het
              ophaal-effect) — zonder deze hint is niet duidelijk waarom er nog
              geen tijden staan. */}
          {handmatigeZoekopdracht === 0 && (
            <p className="mt-3 rounded-md bg-court-50 px-4 py-2 text-sm text-court-800">
              Klik op &quot;🔍 Zoek nu&quot; hierboven om de actuele beschikbaarheid op te halen.
            </p>
          )}

          {handmatigeZoekopdracht > 0 && metingBezig && (
            <p className="mt-3 rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-600">
              Beschikbaarheid ophalen bij {clubsOmTeTonen.length} clubs… dit kan tot een minuut duren, we vragen het
              rechtstreeks bij de boekingssystemen op.
            </p>
          )}

          {metingFout && <p className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{metingFout}</p>}

          {opgehaaldOp && !metingBezig && (
            <p className="mt-2 text-xs text-slate-400">
              Live opgehaald om{" "}
              {new Date(opgehaaldOp).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {gevolgdeClubs.length > 0 && (
            <div className="mt-4">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-court-700">
                <BalIcon className="h-3.5 w-3.5" /> Gevolgde clubs
              </h3>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">{gevolgdeClubs.map(renderKaart)}</div>
            </div>
          )}

          {gevolgdeClubs.length > 0 && overigeClubs.length > 0 && (
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Overige clubs</h3>
          )}

          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">{overigeClubs.map(renderKaart)}</div>

          {zichtbareClubs.length === 0 && (
            <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
              <p className="text-sm text-slate-600">
                Geen clubs die passen bij je filters binnen {straalKm} km van {zoekgebied.plaatsnaam}.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Zet de straal ruimer, kies een andere dag, of wis de voorkeurstijd. We kennen nu {CLUBS.length} clubs.
              </p>
            </div>
          )}
        </>
      ) : (
        // Zonder zoekgebied zijn "alle 514 clubs" kandidaat (clubsInStraal
        // filtert dan niets weg) — die allemaal als kaart renderen terwijl er
        // toch nooit beschikbaarheid voor opgehaald wordt (MAX_ZICHTBAAR
        // houdt dat al tegen) is alleen maar een trage, lege lijst. Xander
        // (4 aug 2026): "hoef je niet 514 clubs op te halen als je
        // uitgelogd bent... toon zoiets van een melding" — dus i.p.v. de
        // volle lijst gewoon het landelijke totaal, met een duwtje richting
        // de woonplaats hierboven.
        <div className="mt-8 rounded-lg border border-dashed border-court-300 bg-court-50 p-6 text-center">
          <p className="text-sm font-medium text-slate-900">
            {TOTAAL_BANEN_LANDELIJK} padelbanen beschikbaar bij {CLUBS.length} clubs door heel Nederland.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kies hierboven je woonplaats om je zoekgebied te verkleinen — dan zien we precies wat er bij jou in de
            buurt vrij is.
          </p>
        </div>
      )}

      <p className="mt-8 text-xs text-slate-400">
        Beschikbaarheid komt live van Playtomic, KNLTB Meet &amp; Play en Foys/Peakz. Gratis testaccounts zien clubs
        waar je openbaar kunt boeken; Pro kan ook verenigingen achter een inlog bekijken en volgen. Afstanden met
        &quot;(ca.)&quot; zijn gemeten tot het midden van de plaats, niet tot het exacte clubadres.
      </p>
      </main>
    </>
  );
}
