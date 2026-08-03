"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CLUBS, LEDEN_CLUBS } from "@/lib/clubs";
import { supabaseBrowser } from "@/lib/supabase/client";
import LocatieKiezer from "@/components/LocatieKiezer";
import { afgerondeAfstand, type GevondenLocatie } from "@/lib/geo";
import { binnenTijdvenster, dagLabel, halfUurOpties, komendeDagen, naarMinuten, rondAfOpHalfUur } from "@/lib/tijd";
import { boekingsBestemming } from "@/lib/boekingsLink";
import type { Club } from "@/lib/types";
import { BalIcon } from "@/components/PadelIcons";

// Zoveel tijden tonen we standaard per club — meer verbergen we achter een
// "Toon alle"-knop. Xander (29 juli 2026): "max 5 tijden tonen ipv alles" —
// bij een populaire club met 20+ vrije tijden maakte de volle lijst de
// pagina onoverzichtelijk op mobiel.
const MAX_TIJDEN_ZICHTBAAR = 5;

const GRATIS_LIMIET = 1;
const OPSLAG_SLEUTEL = "vrijbaan-zoekgebied";
const LID_SLEUTEL = "vrijbaan-lidmaatschappen";
const MARGE_OPTIES = [1, 2, 3];

// Zelfde grens als MAX_CLUBS in src/app/api/beschikbaarheid/route.ts — hier
// nogmaals, zodat de UI al vóór het verzoek kan zeggen dat het te veel is.
const MAX_ZICHTBAAR = 20;

type Slot = { tijd: string; prijs: string | null };
type Meting = { sloten: Slot[]; fout?: string };
type Zoekgebied = { lat: number; lon: number; plaatsnaam: string; straalKm: number };

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

  const dagen = useMemo(() => komendeDagen(), []);
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
  const [negeerStraal, setNegeerStraal] = useState(false);
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

  // Clubs waar de gebruiker zelf lid is. Alleen die ledenclubs doen mee in de
  // lijst — voor een lid zijn hun vrije banen namelijk wél bruikbaar.
  const [lidVan, setLidVan] = useState<Set<string>>(new Set());

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
        setNegeerStraal(false);
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
      // Alleen overnemen als het binnen het venster valt dat de Radar toont
      // (vandaag t/m DAGEN_VOORUIT) — een link naar een dag die niet meer in
      // de tabbladen staat, mag niet stilzwijgend op een verkeerde dag landen.
      const urlDatum = urlParams.get("datum");
      if (urlDatum && dagen.includes(urlDatum)) setGekozenDatum(urlDatum);

      let uitOpslag: Zoekgebied | null = null;
      const lokaal = window.localStorage.getItem(OPSLAG_SLEUTEL);
      if (lokaal) {
        try {
          uitOpslag = JSON.parse(lokaal) as Zoekgebied;
        } catch {
          // Onleesbare opslag negeren; niet de pagina laten struikelen.
        }
      }

      let lidmaatschappen: string[] = [];
      const lidOpslag = window.localStorage.getItem(LID_SLEUTEL);
      if (lidOpslag) {
        try {
          lidmaatschappen = JSON.parse(lidOpslag) as string[];
        } catch {
          // Onleesbare opslag negeren.
        }
      }

      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

      if (lidmaatschappen.length > 0) setLidVan(new Set(lidmaatschappen));

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
          .select("subscription_status, woonplaats, lat, lon, zoekstraal_km, lidmaatschappen, voornaam, achternaam")
          .eq("id", user.id)
          .single(),
      ]);
      setGevolgd(new Set((clubs ?? []).map((r) => r.club_id)));
      setIsPro(profiel?.subscription_status === "pro");
      const naam = [profiel?.voornaam, profiel?.achternaam].filter(Boolean).join(" ");
      if (naam || user.email) setEigenGegevens({ naam, email: user.email ?? "" });
      // Lidmaatschappen uit het account samenvoegen met wat op dit apparaat
      // stond, zodat een vinkje op de Radar niet verdwijnt na inloggen.
      const uitProfielLid: string[] = profiel?.lidmaatschappen ?? [];
      if (uitProfielLid.length > 0 || lidmaatschappen.length > 0) {
        setLidVan(new Set([...lidmaatschappen, ...uitProfielLid]));
      }

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

  // Vrij boekbare clubs + de ledenclubs waar je zelf lid bent.
  const kandidaatClubs = useMemo(
    () => [...CLUBS, ...LEDEN_CLUBS.filter((club) => lidVan.has(club.id))],
    [lidVan]
  );

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
    if (!zoekgebied || negeerStraal) return kandidaatClubs.map((club) => ({ ...club, afstandKm: null as number | null }));
    return kandidaatClubs
      .map((club) => ({ ...club, afstandKm: afgerondeAfstand({ lat: zoekgebied.lat, lon: zoekgebied.lon }, club) }))
      .filter((club) => club.afstandKm <= straalKm || gevolgd.has(club.id))
      .sort((a, b) => a.afstandKm - b.afstandKm);
  }, [kandidaatClubs, zoekgebied, straalKm, negeerStraal, gevolgd]);

  /**
   * Beschikbaarheid halen we op voor precies de clubs die na het straal-filter
   * overblijven, niet voor alle 111 gekoppelde clubs. Reden: Playtomic en
   * Meet & Play kosten elk een Playwright-run van ~15-20 seconden per club, dus
   * "alles ophalen" duurt ruim een uur. Boven MAX_ZICHTBAAR halen we niets op en
   * vragen we de gebruiker zijn selectie te verkleinen — beter een duidelijke
   * vraag dan een verzoek dat minuten hangt.
   *
   * BEWUST NIET automatisch bij laden of bij elke filterwijziging — Xander
   * (2 aug 2026): "die 'bezig met zoeken' zodra de site geopend wordt werkt
   * mij ook tegen, dat moet eruit, pas zoeken op het moment van knop
   * drukken". `handmatigeZoekopdracht` is daarom de ENIGE trigger: die staat
   * op 0 tot de eerste klik op "Zoek nu", dus zowel het laden van de pagina
   * als het wisselen van dag/straal/locatie doet op zichzelf niets meer —
   * pas een nieuwe klik haalt verse data op. clubsInStraal/gekozenDatum
   * staan bewust NIET in de dependency-array (ze worden wél gelezen, via de
   * closure van het moment van de klik): ze mogen het effect niet opnieuw
   * laten afgaan, alleen de knop mag dat.
   */
  useEffect(() => {
    if (handmatigeZoekopdracht === 0) return; // nog niet op "Zoek nu" gedrukt

    const ids = clubsInStraal.map((c) => c.id);
    if (ids.length === 0 || ids.length > MAX_ZICHTBAAR) return;

    let afgebroken = false;

    const haalOp = async () => {
      // De statuswissel staat binnen deze async functie en niet in de body van
      // het effect, zodat React geen cascading render krijgt
      // (react-hooks/set-state-in-effect).
      setMetingBezig(true);
      setMetingFout(null);
      try {
        const res = await fetch(
          `/api/beschikbaarheid?datum=${gekozenDatum}&clubs=${encodeURIComponent(ids.join(","))}`
        );
        const data = await res.json();
        if (afgebroken) return;
        if (!res.ok) { setMetingFout(data.error ?? "Ophalen mislukt."); setMetingBezig(false); return; }
        const map = new Map<string, Meting>();
        for (const rij of data.beschikbaarheid as { clubId: string; sloten: Slot[]; fout?: string }[]) {
          map.set(`${rij.clubId}|${gekozenDatum}`, { sloten: rij.sloten, fout: rij.fout });
        }
        setMetingen((vorige) => new Map([...vorige, ...map]));
        setOpgehaaldOp(data.opgehaaldOp ?? null);
        setMetingBezig(false);
      } catch (e) {
        if (!afgebroken) {
          setMetingFout(e instanceof Error ? e.message : "Ophalen mislukt.");
          setMetingBezig(false);
        }
      }
    };

    haalOp();
    return () => { afgebroken = true; };
    // clubsInStraal/gekozenDatum bewust buiten de dependency-array — alleen
    // handmatigeZoekopdracht (de "Zoek nu"-knop) mag dit effect starten, zie
    // de toelichting hierboven. De huidige waarden worden nog wel gebruikt,
    // via de closure van het moment van de klik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handmatigeZoekopdracht]);


  const kiesLocatie = (loc: GevondenLocatie) => {
    const nieuw: Zoekgebied = { lat: loc.lat, lon: loc.lon, plaatsnaam: loc.woonplaatsnaam ?? loc.weergavenaam, straalKm };
    setZoekgebied(nieuw);
    setNegeerStraal(false);
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
      straal: String(straalKm),
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
    return clubsInStraal
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
      .filter((club) => !voorkeurstijd || !club.meting || club.meting.fout || club.passendeTijden.length > 0);
  }, [clubsInStraal, metingen, gekozenDatum, voorkeurstijd, margeUren]);

  const metPassendeTijd = zichtbareClubs.filter((c) => c.passendeTijden.length > 0).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="baan-hero -mx-6 rounded-b-2xl px-6 py-10 sm:px-8">
        <h1 className="text-3xl font-bold text-white">Beschikbaarheid Radar</h1>
        <p className="mt-2 text-slate-300">
          Kies waar je woont, stel je straal in en kijk tot een week vooruit. Volg een club en krijg een melding
          zodra er een baan vrijkomt.
        </p>
      </div>

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
          <input id="straal" type="range" min="1" max="100" step="1" value={straalKm}
            onChange={(e) => setStraalKm(Number(e.target.value))} className="mt-2 w-full" />
          <div className="flex justify-between text-xs text-slate-400"><span>1 km</span><span>100 km</span></div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={bewaarZoekgebied} disabled={!zoekgebied}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
            Bewaar zoekgebied
          </button>
          {zoekgebied && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={negeerStraal} onChange={(e) => setNegeerStraal(e.target.checked)} />
              Toon alle clubs (straal negeren)
            </label>
          )}
          {bewaarStatus && <span className="text-xs text-slate-500">{bewaarStatus}</span>}
        </div>

        {!zoekgebied && (
          <p className="mt-3 text-xs text-amber-700">Nog geen locatie gekozen — je ziet nu alle clubs die we kennen.</p>
        )}

      </section>

      {/* Wanneer wil je spelen? */}
      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Wanneer wil je spelen?</h2>
          {/* Expliciete trigger i.p.v. alleen automatisch verversen — zichtbare
              feedback (spinner-tekst + disabled) zodat een klik voelbaar iets
              doet, ook als de filters ongewijzigd zijn. */}
          <button
            type="button"
            onClick={() => setHandmatigeZoekopdracht((n) => n + 1)}
            disabled={metingBezig}
            className="rounded-md bg-court-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-court-700 disabled:opacity-60"
          >
            {metingBezig ? "Bezig met zoeken…" : "🔍 Zoek nu"}
          </button>
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
            Klik op &quot;Zoek nu&quot; hierboven om te zoeken naar een vrije baan rond {voorkeurstijd}.
          </p>
        )}
        {voorkeurstijd && handmatigeZoekopdracht > 0 && metingBezig && (
          <p className="mt-3 text-sm text-slate-500">Nog aan het zoeken naar een vrije baan rond {voorkeurstijd}…</p>
        )}
        {voorkeurstijd && handmatigeZoekopdracht > 0 && !metingBezig && (
          <p className="mt-3 text-sm text-slate-600">
            {metPassendeTijd > 0
              ? `${metPassendeTijd} club(s) met een vrije baan rond ${voorkeurstijd} (± ${margeUren} uur).`
              : `Geen enkele gemeten club heeft een vrije baan rond ${voorkeurstijd} (± ${margeUren} uur).`}
          </p>
        )}
      </section>

      {/* Ledenclubs: geen los toggle-blok meer hier — Xander (30 juli 2026):
          "haal het stuk van ben je lid van een vereniging naar het account
          tabblad, dat is de plek voor instellingen". lidVan wordt nu alleen
          nog gelezen (uit localStorage + profiel.lidmaatschappen, zie de
          init-effect hierboven), niet meer hier bewerkt. Wie een ledenclub
          wil ontgrendelen, doet dat voortaan op /account. */}
      {LEDEN_CLUBS.length > 0 && userId === null && (
        <p className="mt-4 text-xs text-slate-400">
          Lid van een vereniging? <Link href="/login" className="underline">Log in</Link> en zet het in je account
          om hun vrije banen ook hier te zien.
        </p>
      )}

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

      <h2 className="mt-8 font-semibold text-slate-900">
        {zichtbareClubs.length} {zichtbareClubs.length === 1 ? "club" : "clubs"}
        {zoekgebied && !negeerStraal ? ` binnen ${straalKm} km` : ""}
      </h2>

      {/* Boven de grens halen we bewust niets op: dat zou minuten duren. */}
      {clubsInStraal.length > MAX_ZICHTBAAR && (
        <div className="mt-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{clubsInStraal.length} clubs is te veel om live op te vragen.</strong> We halen beschikbaarheid
          op bij de boekingssystemen zelf, en dat kost per club een paar seconden. Maak je selectie kleiner
          (maximaal {MAX_ZICHTBAAR}) — zet bijvoorbeeld de straal lager of vink &quot;Toon alle clubs&quot; uit.
        </div>
      )}

      {/* Zoeken gebeurt niet meer automatisch (zie de toelichting bij het
          ophaal-effect) — zonder deze hint is niet duidelijk waarom er nog
          geen tijden staan. */}
      {clubsInStraal.length <= MAX_ZICHTBAAR && handmatigeZoekopdracht === 0 && (
        <p className="mt-3 rounded-md bg-court-50 px-4 py-2 text-sm text-court-800">
          Klik op &quot;🔍 Zoek nu&quot; hierboven om de actuele beschikbaarheid op te halen.
        </p>
      )}

      {clubsInStraal.length <= MAX_ZICHTBAAR && handmatigeZoekopdracht > 0 && metingBezig && (
        <p className="mt-3 rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-600">
          Beschikbaarheid ophalen bij {clubsInStraal.length} clubs… dit kan tot een minuut duren, we vragen het
          rechtstreeks bij de boekingssystemen op.
        </p>
      )}

      {metingFout && <p className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{metingFout}</p>}

      {opgehaaldOp && !metingBezig && clubsInStraal.length <= MAX_ZICHTBAAR && (
        <p className="mt-2 text-xs text-slate-400">
          Live opgehaald om{" "}
          {new Date(opgehaaldOp).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      <div className="mt-3 space-y-3">
        {zichtbareClubs.map((club) => {
          const isGevolgd = gevolgd.has(club.id);
          return (
            <div key={club.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">{club.naam}</p>
                  <p className="text-sm text-slate-500">
                    {club.plaats} · {club.banen > 0 ? `${club.banen} banen · ` : ""}{club.systeem}
                    {club.afstandKm !== null && (
                      <>
                        {" · "}
                        <span className="font-medium text-slate-700">{club.afstandKm} km</span>
                        {club.coordinaatBron === "woonplaats" && (
                          <span className="text-slate-400" title="Afstand tot het midden van de plaats, niet tot het clubadres"> (ca.)</span>
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
                  {club.meting?.fout && (
                    <p className="mt-1 text-xs text-amber-700">{club.meting.fout}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button onClick={() => toggle(club.id)}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition ${isGevolgd ? "bg-court-600 text-white hover:bg-court-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                    {isGevolgd ? "Wordt gevolgd ✓" : "Volg deze club"}
                  </button>
                  <button onClick={() => deelClub(club)} disabled={!zoekgebied}
                    className="text-xs font-medium text-slate-500 hover:text-court-700 disabled:opacity-50">
                    {gedeeld === club.id ? "Gekopieerd ✓" : "Deel met je groep"}
                  </button>
                  {/* Bij een ledenclub is het boekingssysteem afgeschermd, dus
                      wijst "Boek hier" naar de clubsite: daar staat hoe je als
                      lid reserveert. */}
                  {(() => {
                    const isLedenClub = club.boekbaarZonderLidmaatschap === false;
                    const url = isLedenClub ? club.websiteUrl ?? club.boekingsUrl : club.boekingsUrl;
                    if (!url) return null;
                    return (
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-court-700 underline">
                        {isLedenClub ? "Naar de clubsite →" : "Boek hier →"}
                      </a>
                    );
                  })()}
                </div>
              </div>

              {/* Vrije tijden zelf tonen, niet alleen het aantal — PROJECTPLAN.md §3. */}
              {club.meting && !club.meting.fout && (
                <div className="mt-3 border-t border-slate-100 pt-3">
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
        })}

        {zichtbareClubs.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-sm text-slate-600">
              Geen clubs die passen bij je filters{zoekgebied ? ` binnen ${straalKm} km van ${zoekgebied.plaatsnaam}` : ""}.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Zet de straal ruimer, kies een andere dag, of wis de voorkeurstijd. We kennen nu {CLUBS.length} clubs.
            </p>
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Beschikbaarheid komt live van Playtomic, KNLTB Meet &amp; Play en Foys/Peakz. Clubs waar je alleen met een
        lidmaatschap of login kunt boeken, tonen we hier niet. Afstanden met &quot;(ca.)&quot; zijn gemeten tot het
        midden van de plaats, niet tot het exacte clubadres.
      </p>
    </main>
  );
}
