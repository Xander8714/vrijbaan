# Projectplan: Padel Radar Haarlem + Opstelling-tool

**Datum:** 19 juli 2026
**Status:** Concept — klaar om te bouwen
**Auteur:** Xander (met onderzoek/uitwerking via Claude)

---

## 0. Stand van zaken (29 juli 2026)

### Wat vandaag opgelost is — met bewijs

- **Playtomic werkt weer.** `scripts/scrape-playtomic.ts` (Playwright op
  `playtomic.com/clubs/<slug>?date=YYYY-MM-DD`, mobiele viewport) is live
  geverifieerd: WePadel gaf **419 sloten / 27 starttijden**, PADEL25 **19
  sloten / 7 starttijden** voor 30 juli 2026. De dode fetch-client is uit de
  polling-laag gehaald; `src/lib/scrapers/playtomic.ts` blijft staan als
  vastlegging waarom Route B niet werkt.
- **Peakz/Foys werkt — en levert heel Nederland.** De oorzaak van de eerdere
  lege `[]` is gevonden: de Foys-API vereist de headers
  `x-organisationid` en `x-federationid` (beide
  `df82f4dd-fd87-4af5-9c2f-656fe1a44357`). Zonder die headers antwoordt de API
  **200 met een lege array** — geen foutcode, dus het leek op "niets vrij"
  i.p.v. op een ontbrekende organisatiecontext. Dát is waarom dit eerder
  verkeerd gelezen is. Met de headers erbij: **26 Peakz-vestigingen** met
  exacte coördinaten, adressen, prijzen en `isAvailable` per tijdslot.
  Gegenereerd naar `src/lib/clubs.foys.ts` via `npm run import:foys`.
- **Fout in eerdere documentatie gecorrigeerd:** het locationId
  `527bd7b9-d8d3-4c43-a2cb-997e5baa0527` dat in API_REQUIREMENTS.md §3 als
  "Haarlem" stond, is **Amersfoort**. Haarlem is
  `f5b45a7e-3e05-4b86-bb73-8a01dbb27ae9`.
- **Landelijk zoeken op straal.** Adres/woonplaats opzoeken via de PDOK
  Locatieserver (gratis, geen API-key, live geverifieerd), straal in km,
  clubs gefilterd en gesorteerd op afstand, plus "plaatsen in de buurt".
  Ook een "Gebruik mijn locatie"-knop via de Geolocation API van de browser
  zelf — geen IP-lookupdienst van derden.
- **48 uur vooruit + voorkeurstijd.** Radar heeft dagtabs (vandaag/morgen/
  overmorgen) en een voorkeurstijd met marge ± 1/2/3 uur.
- **Clubs met een inlogmuur worden niet meer getoond** (`Club.boekbaarZonderLidmaatschap`).
  Overhout (inlogmuur) en Pim Mulier (ledenstop) zijn verborgen.
- **Wachtwoord vergeten** is gebouwd (`/login` + `/wachtwoord-resetten`).
- **Accountpagina** toont en bewaart nu eigen gegevens (naam, speelsterkte,
  adres, woonplaats, zoekstraal).
- **Clubs kunnen zich aanmelden** via `/club-aanmelden`. Aanmeldingen komen in
  `club_aanmeldingen` met status `nieuw` en worden **nooit automatisch
  gepubliceerd**: KvK-nummer of verenigingsregistratie is verplicht en wordt
  handmatig nagetrokken.

### Twee afstandsmaten — niet verwarren
PDOK's `afstand` is de afstand tot de **rand** van een woonplaats; onze
`afstandKm` is middelpunt-tot-middelpunt. Voorbeeld: PDOK meldt Overveen op
1,6 km van Haarlem-centrum, hemelsbreed tussen de middelpunten is het 5,79 km.
Een test die uitging van 1,6 km faalde terecht en is gecorrigeerd.

### Opstelling-optimizer verwijderd uit de app (29 juli 2026)
Eerdere versie van deze paragraaf stelde voor Opstelling te herpositioneren
als teamfunctie (`/account/team`). **Achterhaald door een hard besluit van
Xander diezelfde dag: "haal opstelling eruit, ik vind deze niet meer passen
bij de app."** Uitgevoerd: nav-tab, homepage-kaart, pricing-bullet en
help-usecase verwijderd; de route `src/app/opstelling/` is verwijderd.
`src/lib/lineup.ts` (het rekenmodel) + de tests blijven staan — dat wordt al
herbruikt in `vrijbaan-mobile` (§9.1) en weggooien van getest werkend werk
zonder noodzaak is nergens goed voor. §4 (het oorspronkelijke featureplan) en
§9.4 (mobiele scope v1) hieronder zijn beide bijgewerkt. VrijBaan is
hiermee **één product: de beschikbaarheid-radar.**

### Eerste echte meting (29 juli 2026, `npm run check -- Haarlem 10 2026-07-30 12:00 2`)
9 clubs binnen 10 km van Haarlem, gevraagd naar morgen rond 12:00 (± 2 uur):

| Club | Rond 12:00 |
|------|------------|
| WePadel Haarlem | 10:00–14:00, 9 tijden (27 die dag) |
| Peakz Padel Haarlem-Haarlemmerstroom | 10:00–14:00, 9 tijden (16 die dag) |
| LTC Hofgeest (Velserbroek) | 10:30–14:00, 8 tijden (17 die dag) |
| PADEL25 Haarlem | niets rond 12:00; wel 17:00–21:30 |
| Schoten, Groeneveen | geen Meet & Play-club-id bekend |
| Padelhill, Padelpoints Hoofddorp, PadelPark 21 | inmiddels wél in POLL_CONFIG |

Alle drie de aanbieders (Playtomic, Foys, Meet & Play) leveren dus in één run
echte data. Dit is de eerste keer dat dat aantoonbaar is.

### Overige boekingssystemen live onderzocht — geen enkele bouwbaar (29 juli 2026, derde ronde)
Op verzoek "volledig uitgewerkt net als Playtomic en Meet & Play": alle 7
platforms uit de eerdere researchronde (§3b) live getest tegen echte NL-
padelclubs, niet alleen marketingteksten. Uitkomst, per reden (zie
API_REQUIREMENTS.md §3b voor het volledige verslag):
- **Bookaball**: geblokkeerd door Cloudflare-botdetectie — bewust niet omzeild.
- **Baanreserveren + OpenResa**: platform-breed inlogmuur, bevestigd met
  meerdere echte clubs (niet alleen Overhout). Niet bouwbaar zonder
  derdenwachtwoorden op te slaan, wat we niet doen.
- **i-Reserve, Booqr, BookLux**: geen enkele bevestigde, echte NL-padelclub
  gevonden om tegen te bouwen/verifiëren (referenties zijn andere sporten/
  branches, of het platform is geherbrand).
- **Aqqo**: wél toegankelijk (geen inlogmuur), maar of het systeem
  daadwerkelijk per tijdslot op bezetting filtert kon niet bevestigd worden —
  een waarschijnlijk-bezet avondslot werd zonder foutmelding geaccepteerd.
  Beperkte NL-padeldekking, dus de investering weegt niet op tegen de baat.

Dit is dus geen onvolledig werk maar een afgeronde, eerlijke conclusie: van
de 10 onderzochte NL-boekingssystemen (Playtomic, Foys, Meet & Play +
bovenstaande 7) zijn er drie daadwerkelijk publiek bouwbaar gebleken, en die
drie zijn ook gebouwd.

### P1 landelijke uitbreiding afgerond (29 juli 2026, tweede sessie-ronde)
Na de polling-fix (zie hieronder) is de rest van de P1-lijst afgewerkt:
- **Meet & Play landelijk**: een complete directory gevonden
  (`meetandplay.nl/club`, sportfilter Padel, 401 clubs op één pagina, geen
  crawl nodig) → 388 clubs geïmporteerd via `scripts/discover-meetandplay-clubs.ts`.
- **Ledencheck Schoten/Groeneveen/Pim Mulier**: alle drie bevestigd boekbaar
  zonder lidmaatschap (zelfde KNLTB ID-mechanisme als Hofgeest) — zelfs Pim
  Mulier ondanks een "ledenstop senioren". Sterke aanwijzing dat dit een
  KNLTB-breed platformkenmerk is, geen per-club-instelling.
- **Totaal nu 501 clubs** (was 112): 392 Meet & Play + 83 Playtomic + 26 Foys.
- **Meet & Play-prijs**: onderzocht, bewust NIET gebouwd — prijs blijkt
  dynamisch per tijdstip (€20 vs €25 op dezelfde dag/club), dus alleen te
  achterhalen door elk tijdstip apart aan te klikken. Te duur om standaard te
  doen bovenop de al kostbare Playwright-scrape.
- **Overige boekingssystemen**: eerste ronde research (Bookaball, i-Reserve,
  Booqr, Aqqo, BookLux, OpenResa) — nog niet live geverifieerd, zie
  API_REQUIREMENTS.md §3b.
- **Playtomic-crawl continuering bewust overgeslagen** deze ronde — gezien de
  403-bevinding (hieronder) leek het onverstandig om Playtomic meteen opnieuw
  zwaar te belasten.

### Polling-job selectief gemaakt + eerste echte end-to-end run (29 juli 2026)
`scripts/poll-availability.ts` pollt niet meer "alles in POLL_CONFIG", maar:
1. altijd alle clubs die minstens één gebruiker volgt (`gevolgde_clubs`);
2. daarnaast een kleine, tijdgebaseerd roterende batch niet-gevolgde clubs
   (`kiesRotatieBatch`, 8 clubs per blok van 5 min, geen cursor-tabel nodig —
   het blok volgt puur uit `Date.now()`). 6 nieuwe tests in
   `src/lib/__tests__/pollRotatie.test.ts`.

**Eerste echte run tegen de live database (nooit eerder gedaan):** werkte
end-to-end — las `gevolgde_clubs`, koos 1 gevolgde club + 8 rotatieclubs × 3
dagen, scrapete ze, schreef naar `club_beschikbaarheid`. Ook `main()` had
géén module-guard (`require.main === module`) — daardoor startte de hele job
al bij het simpelweg IMPORTEREN van het bestand, wat de nieuwe unit test
(die alleen `kiesRotatieBatch` nodig had) per ongeluk een volledige
polling-run liet triggeren. Gefixt. Ook: `tsx` laadt `.env.local` niet
automatisch zoals Next.js dat doet — opgelost met Node's ingebouwde
`process.loadEnvFile()` (geen nieuwe dependency nodig, Node 24).

**⚠️ Bevinding die nog uitgezocht moet worden — Playtomic-403 bij snel
herhaald draaien.** Twee clubs die in de eerste run gewoon slaagden, gaven in
een tweede run (enkele minuten later) een 403 terug. Omdat exact dezelfde
slug net daarvoor nog werkte, is een dode/foutieve slug onwaarschijnlijk —
dit wijst eerder op een WAF/rate-limit die reageert op herhaald geautomatiseerd
verkeer vanaf hetzelfde IP. **Belangrijk voor de 5-10 min-cyclus**: als
Playtomic bij elke ronde alle rotatieclubs opnieuw bezoekt vanaf hetzelfde
IP, loop je risico op structurele blokkades. Nog te doen vóór dit op een
cron gaat: request-frequentie per club beperken (bv. niet vaker dan 1x per
X minuten per club, ongeacht rotatieblok), en/of retries met backoff i.p.v.
een enkele 403 meteen als "mislukt" loggen. Telegram is in deze sessie
bewust NIET getest (dat komt vóór uitrol, zie hierboven) — deze run had dus
geen TELEGRAM_BOT_TOKEN gezet, wat correct als "alleen loggen" werd
afgehandeld.

### Beschikbaarheid op aanvraag i.p.v. alles pollen (29 juli 2026)
De Radar vraagt beschikbaarheid nu live op via
`src/app/api/beschikbaarheid/route.ts`, en alléén voor de clubs die na het
straal-filter overblijven. Reden: Foys levert 26 vestigingen in één call, maar
Playtomic en Meet & Play kosten elk een Playwright-run van ~15-20 s per club —
alle 111 clubs pollen duurt ruim een uur. Boven **20 clubs** haalt de route
niets op (HTTP 413) en vraagt de UI om de selectie te verkleinen.
Live geverifieerd: morgen gaf Peakz Haarlem 16 en WePadel 27 starttijden;
25 clubs gaf 413.

**Bug gevonden en gefixt in dezelfde sessie:** de Foys-API gaf om 23:23 nog
gewoon 08:00–22:00 als beschikbaar terug — bronnen filteren zelf niet op "nu".
De route filtert verstreken tijden nu weg voor vandaag (`alleenToekomstig`);
vandaag om 23:24 geeft Peakz daardoor een lege lijst i.p.v. onboekbare
ochtendtijden.

### Wat nog NIET af is
- **Meet & Play landelijk**: alleen Hofgeest (29942) is bekend. Er is nog geen
  clubdirectory uitgezocht. Let op de spanning met de eis "geen clubs met
  ledenreservering": Meet & Play is primair een verenigingsplatform, dus een
  groot deel van die clubs valt straks alsnog af. Eerst uitzoeken of een
  niet-lid daar kan boeken, dán massaal importeren.
- **Playtomic landelijk**: `npm run discover:playtomic -- <max>` ontdekt clubs
  via de "clubs in de buurt"-links op elke clubpagina. Werkt, maar een
  volledige landelijke crawl is een run van tientallen minuten.
- **Baanreserveren/andere systemen**: nog niet onderzocht.
- Verenigingsclubs Schoten/Hofgeest/Groeneveen staan op
  `boekbaarZonderLidmaatschap: null` (onbekend) en worden mét waarschuwing
  getoond — nog te verifiëren.

### Oorspronkelijke prioriteit (24 juli 2026) — afgehandeld
**Bouw een Playwright-scraper voor Playtomic (WePadel + PADEL25), naar het
voorbeeld van `scripts/scrape-meetandplay.ts`.**

Reden: `src/lib/scrapers/playtomic.ts` (kale fetch-client op
`api.playtomic.io/v1/availability`) is getest en **werkt niet meer** — niet
alleen in de bouw-sandbox, ook vanaf een gewone Chrome-sessie op een normale
verbinding (CloudFront 403 / CORS-blok, zie API_REQUIREMENTS.md §1).
Playtomic rendert beschikbaarheid nu server-side op `playtomic.com`, dus de
data staat wél gewoon in de pagina (bevestigd via screenshot van
`playtomic.com/clubs/wepadel-haarlem`), maar is niet via een aparte
JSON-aanroep te benaderen.

Zonder deze scraper is Radar voor WePadel en PADEL25 niet meer dan een
lege plek in `pollConfig.ts` — dit is dus de blokkerende stap vóór alle
andere openstaande punten (Foys-parser, Overhout-inlogmuur, mobiele app).
Zie §6 (bouwvolgorde) en §8 voor de technische details.

**Ontbrekende flow — nog te bouwen:** `/login` heeft alleen inloggen/registreren,
geen "wachtwoord vergeten". Bij een vergeten wachtwoord kan een gebruiker nu
alleen geholpen worden via de Supabase-admin-API/dashboard (service role key) —
niet zelfstandig. Toevoegen: `supabase.auth.resetPasswordForEmail()` + een
`/wachtwoord-resetten`-pagina die de reset-link afhandelt (Supabase stuurt
gebruiker terug met een recovery-token in de URL).

**Bug gefixt (29 juli 2026):** de handmatige "Speelsterkte opzoeken →"-link op
de Opstelling-pagina (`src/app/opstelling/page.tsx`) wees naar
`https://mijn.knltb.nl`, een domein dat niet resolvet (DNS-fout, bevestigd
23 juli 2026). Wijst nu naar `https://www.toernooi.nl/find/player` (de
publieke spelerszoeker die de "Zoek op KNLTB"-knop ook al gebruikt).

**Test-observatie (29 juli 2026) — bondsnummer 41844920 niet vindbaar:**
zowel via de app (`/api/knltb-speelsterkte?bondsnummer=41844920`) als via
handmatig zoeken op `toernooi.nl/find/player?q=xander` (56 resultaten, geen
"Xander van den Heuvel" ertussen) levert dit bondsnummer/naam geen match op.
Vermoedelijk verkeerd bondsnummer of afwijkende schrijfwijze — geen
technisch probleem in de scraper zelf (zie ook §7, laatste punt).

**Let op bij handmatig testen van toernooi.nl in een gewone Chrome-tab:**
als de browser al een actieve MijnKNLTB-sessie heeft (cookies gedeeld op
`.toernooi.nl`), stuurt navigatie naar het publieke
`www.toernooi.nl/find/player` soms door naar de ingelogde
`mijnknltb.toernooi.nl` — dus test dit bij voorkeur in een schone/incognito
sessie. De Playwright-scraper in `src/lib/scrapers/knltb.ts` draait in een
eigen geïsoleerde browsercontext en heeft hier geen last van.

---

## 1. Het probleem

Padel groeit in Nederland harder dan het aanbod aan banen: 876.000 spelers in 2025, banen +25%, maar spelersaantal groeit sneller. Gevolg: wachtlijsten en volle clubs, vooral in dichtbevolkte regio's. Daarbovenop is het boekingslandschap versnipperd — spelers hebben 2-3 apps nodig (Playtomic voor commerciële clubs, KNLTB Meet & Play voor verenigingen) en beschikbaarheid is vaak alleen binnen een beperkt tijdvenster zichtbaar.

Daarnaast: teams die meedoen aan de KNLTB-competitie (7.400+ teams landelijk) moeten elke speelronde zelf hun koppel-opstelling bepalen — op basis van afnemende speelsterkte — zonder hulpmiddel om dit datagedreven te doen.

Twee losse problemen, één regionale app om mee te beginnen, met een landelijk uitbreidbaar tweede feature.

---

## 2. Regio-scope: Haarlem + 5 km

| Club | Plaats | Banen | Systeem | Status (2026) |
|------|--------|-------|---------|----------------|
| Racketclub Overhout | Haarlem | 5 | **Baanreserveren** (bevestigd) | Vol, wachtlijst dicht — boeksysteem vereist inloggen, geen publieke view |
| TPV Pim Mulier | Haarlem | — | Meet & Play (vereniging) | Ledenstop senioren, wachtlijst heropend |
| WePadel Haarlem | Haarlem | 8 | Playtomic (bevestigd) | Grootste outdoor club van NL |
| Peakz Padel Haarlem | Haarlem | 4 | **Foys** (bevestigd) | Vestiging "Haarlemmerstroom", publiek GET-endpoint |
| PADEL25 Haarlem | Haarlem | 4 | Playtomic (bevestigd) | — |
| Schoten Tennis & Padel | Haarlem | 4 | Meet & Play (vereniging) | — |
| LTC Hofgeest | Velserbroek | 3 | Meet & Play (vereniging) | — |
| LTC Groeneveen | Santpoort-Noord (Driehuis+5km) | 10 | Meet & Play (vereniging) | — |

**Totaal: 8 locaties, ~47 banen.** De twee wachtlijst-clubs (Overhout, Pim Mulier) zijn je beste bron voor de eerste testgebruikers — die mensen zoeken nu al actief naar een plek.

*Update 23 juli 2026: alle 8 boekingssystemen zijn nu bevestigd via live onderzoek
(devtools/netwerk-inspectie) — zie API_REQUIREMENTS.md. Overhout is de uitzondering:
wel bevestigd (Baanreserveren), maar achter een inlogmuur, dus nog niet op te nemen
in de publieke polling-laag zoals de andere drie systemen.*

---

## 3. Feature 1 — Beschikbaarheid-notifier (MVP)

**Wat het doet:** monitort vrije padel-slots bij de 8 clubs en stuurt een melding (WhatsApp of push) zodra een slot vrijkomt dat past bij de voorkeur van de gebruiker (club, dag, tijdvak).

**Waarom dit werkt:** lost een acuut, actueel probleem op (schaarste + versnippering) voor een doelgroep die je nu al kunt aanspreken via je eigen padelnetwerk en de wachtlijsten.

**Technisch:**
- Twee databronnen: Playtomic (heeft een halfopen API die veel tools al gebruiken) en KNLTB Meet & Play (waarschijnlijk alleen te scrapen, geen publieke API — moet uitgezocht worden).
- Polling-service die periodiek (bv. elke 5-10 min) beschikbaarheid ophaalt en vergelijkt met vorige stand → bij nieuw vrij slot: trigger notificatie.
- Notificatiekanaal: begin met een simpele Telegram-bot of push (makkelijker te bouwen dan WhatsApp Business API, geen goedkeuringsproces nodig). WhatsApp kan later als upgrade.
- Gebruikersvoorkeuren: club(s), dagen, tijdvak, eventueel maximale prijs.
- **UI-eis (24 juli 2026):** bij een gevolgde club niet alleen het aantal vrije
  sloten tonen (huidige staat, `live.slots.length`) maar de **daadwerkelijke
  tijden zelf** — dus de vrije starttijden uitklappen/tonen zodra je een club
  volgt, niet pas na een notificatie. Radar-pagina (`src/app/radar/page.tsx`)
  heeft de sloten-data al in `beschikbaarheid`; dit is een weergave-uitbreiding,
  geen nieuwe databron.

**Risico's:**
- Scrapen van Meet & Play kan tegen gebruiksvoorwaarden ingaan of instabiel zijn (site-structuur kan veranderen) — bouw dit met foutafhandeling en monitoring.
- Playtomic kan rate-limits hanteren — niet te vaak pollen.

**Monetisatie:** freemium (bv. 1 gratis club volgen, 3 meldingen per week) → €2,50-5/mnd voor onbeperkt volgen van meerdere clubs/tijden.

**Eerste gebruikers:** eigen club/vriendengroep in Haarlem + gerichte outreach naar de wachtlijsten van Overhout en Pim Mulier (bijv. via de clubs zelf vragen of je een berichtje mag plaatsen).

---

## 4. Feature 2 — Team-opstelling optimizer (VERWIJDERD, zie §0)

> **29 juli 2026 — uit de app gehaald** op besluit van Xander ("past niet meer
> bij de app"). De rest van deze paragraaf is de oorspronkelijke featureplan,
> bewaard als geschiedenis — niet meer de huidige status. Het rekenmodel
> (`src/lib/lineup.ts`) leeft door in `vrijbaan-mobile` (§9.1), maar staat niet
> meer in de webapp.

**Context (KNLTB-regels):** teams stellen zelf koppels samen en zetten deze in volgorde van afnemende speelsterkte (schaal 1 = professioneel, 9 = beginner); het sterkste koppel speelt altijd wedstrijd 1. De aanvoerder kiest dus vrij *wie met wie* een koppel vormt — dat bepaalt indirect tegen welk tegenstander-koppel je uitkomt.

**Wat de tool doet:** aanvoerder voert de beschikbare spelers van die speeldag in (met hun speelsterkte/rating). De tool berekent welke koppel-combinaties de sterkste totale opstelling opleveren, en — als de tegenstander vooraf bekend is via MijnKNLTB — een verwachte winkans per koppel-matchup op basis van het ratingverschil (vergelijkbaar met een Elo-verwachtingsformule).

**Technisch:** dit is in de kern een toewijzingsprobleem (assignment problem) — geen zware AI nodig, wel een helder rekenmodel:
1. Bereken voor elk mogelijk koppel uit je roster een gecombineerde sterkte.
2. Rangschik mogelijke koppel-indelingen op basis van verwachte totaalscore tegen de bekende of geschatte tegenstander-opstelling.
3. Toon de aanvoerder de aanbevolen indeling + verwachte winkans per wedstrijd.

**Waarom dit apart waardevol is:** dit probleem is niet regio-gebonden — elk van de 7.400+ competitieteams in Nederland heeft het elk competitieweekend (voorjaar én najaar). Dit is het onderdeel met de meeste landelijke schaal.

**Volgorde:** eerst bouwen als extra feature binnen de Haarlem-app (test met je eigen team), later loskoppelen en landelijk aanbieden — los van beschikbaarheid-notifier, aan elke club/team in Nederland.

---

## 5. Tech stack (aansluitend op wat je al hebt)

- **Frontend/app:** Next.js + TypeScript + Tailwind (je hebt dit al opgezet)
- **Backend:** Next.js API routes of losse Node service voor de polling-job
- **Database:** Postgres (bv. via Supabase — snel te starten, gratis tier voldoende voor MVP)
- **Notificaties:** Telegram Bot API (MVP) → WhatsApp Business API (later)
- **Hosting:** Vercel (frontend) + een klein cron-/worker-proces voor de polling (Vercel Cron of een losse Railway/Render service)

---

## 6. Bouwvolgorde (voorstel)

1. **Week 1:** Playtomic + Meet & Play data-toegang uitzoeken per club (API vs. scrapen), datamodel opzetten.
2. **Week 2:** Polling-service + Telegram-notificaties voor 2-3 clubs (start met Overhout en Pim Mulier — hoogste urgentie).
3. **Week 3:** Uitbreiden naar alle 8 locaties, voorkeuren-instellingen voor gebruikers, eenvoudige landingpagina.
4. **Week 4:** Eerste testgroep (eigen netwerk + wachtlijst-mensen), feedback verwerken.
5. **Daarna:** Team-opstelling optimizer bouwen als tweede feature, testen met eigen team tijdens najaarscompetitie 2026.

---

## 7. Openstaande vragen om uit te zoeken

- Heeft Playtomic een (semi-)publieke API of moet dit ook gescraped worden?
  → **Beantwoord**: onofficiële `/v1/availability` endpoint werkt zonder auth
  (zie API_REQUIREMENTS.md §1). tenant_id's voor WePadel en PADEL25 bevestigd.
- Zijn de verenigingsclubs (Pim Mulier, Schoten, Hofgeest, Groeneveen) allemaal via Meet & Play te benaderen, of hebben sommige een eigen boekingssysteem?
  → Hofgeest bevestigd via Meet & Play, scraper end-to-end werkend (incl.
  datumnavigatie). Pim Mulier/Schoten/Groeneveen nog niet individueel geverifieerd.
- Is er toestemming nodig van clubs om hun beschikbaarheid te monitoren/hergebruiken?
- Zijn spelers-speelsterktes en tegenstander-opstellingen via MijnKNLTB programmatisch op te vragen, of alleen handmatig in te voeren door de gebruiker?
  → **Deels beantwoord (23 juli 2026)**: MijnKNLTB draait op `mijnknltb.toernooi.nl`,
  een instantie van Tournament Software (Visma) — geen publieke API, gewoon
  loginnaam/wachtwoord, nog geen OAuth ("binnenkort inloggen met je KNLTB ID"
  staat er zelf als toekomstplan). Programmatisch ophalen kan dus alleen via
  een ingelogde sessie (zelfde risicoprofiel als Overhout/Baanreserveren) —
  zie §10 voor de uitwerking en de risico's daarvan.
- Welk boekingssysteem gebruiken Peakz Padel Haarlem en Racketclub Overhout?
  → **Beantwoord (23 juli 2026)**: Peakz draait op "Foys" (api.foys.io,
  publiek GET-endpoint, locationId "Haarlemmerstroom" — parser nog te bouwen,
  zie API_REQUIREMENTS.md §3). Overhout draait op "Baanreserveren"
  (overhout.baanreserveren.nl), maar vereist inloggen — geen publieke
  beschikbaarheid-view, dus (nog) niet op te nemen in de polling-laag
  (API_REQUIREMENTS.md §4).

## 8. Status scraper + polling-laag (bijgewerkt 23 juli 2026)

- `scripts/scrape-meetandplay.ts`: end-to-end getest tegen Hofgeest (29942).
  Sport- en tijdslot-selectors kloppen nog. Datumnavigatie toegevoegd (accepteert
  optioneel `YYYY-MM-DD`-argument) — zie API_REQUIREMENTS.md §2 voor de
  technische details (Pikaday + Livewire `.set()`-aanroep).
- `scripts/poll-availability.ts`: polling-job gebouwd (vandaag + 2 dagen
  vooruit), pollt Hofgeest via de Meet & Play-scraper en WePadel/PADEL25 via
  Playtomic, diff't tegen `club_beschikbaarheid` in Supabase (nieuwe tabel,
  zie `supabase/schema.sql`) en stuurt een Telegram-bericht bij een nieuw
  slot. Bedoeld om extern gepland te worden (Vercel Cron/Railway), niet als
  onderdeel van de Next.js request-cyclus.
- `src/app/radar/page.tsx` leest nu live uit `club_beschikbaarheid` voor de
  gekoppelde clubs; overige clubs tonen nog de handmatige statustekst.
- **Update 24 juli 2026 — Playtomic-client blijkt écht niet te werken, niet
  alleen in de sandbox.** Eerder stond hier dat de CloudFront 403 een
  sandbox-specifiek IP-blok was. Dat is nu getest via een gewone Chrome-sessie
  op een normale verbinding en weerlegd: zelfde 403 bij directe navigatie, en
  een `fetch()` vanuit `playtomic.com` zelf gaf `Failed to fetch` (CORS/WAF-
  blok). Playtomic's site draait nu op `playtomic.com` en rendert
  beschikbaarheid server-side (React Server Components) — de browser roept
  `api.playtomic.io` niet meer aan bij normaal gebruik. Dat oude endpoint is
  dus vermoedelijk uitgefaseerd. **Gevolg: WePadel en PADEL25 kunnen (nog)
  niet via `fetchPlaytomicAvailability` gepolld worden** — de data staat wel
  gewoon in de gerenderde pagina, dus het realistische alternatief is een
  Playwright-scraper zoals bij Meet & Play, of alsnog de officiële Route A
  (Bearer-token per club) aanvragen. Zie API_REQUIREMENTS.md §1 voor de
  volledige onderbouwing.
- Ook niet end-to-end getest: de Supabase-lees/schrijf-cyclus en de Telegram-
  notificatie zelf — die sandbox had geen `.env` met echte Supabase-
  credentials of een Telegram-bot-token. Wel bevestigd dat het script bij
  ontbrekende config een duidelijke foutmelding geeft i.p.v. stil te falen.
- Nog open: Pim Mulier/Schoten/Groeneveen (Meet & Play-clubs, andere club-id's
  dan Hofgeest) en Peakz/Overhout (systeem nog onbevestigd) toevoegen aan
  `src/lib/pollConfig.ts` zodra hun club-id/tenant_id bekend is.

## 9. Mobiele app (native iOS + Android, App Store/Play Store)

**Besluit (23 juli 2026), na afweging van 5 punten:**

### 9.1 Aanpak: React Native / Expo
Geen aparte Swift + Kotlin trajecten. Eén codebase, `vrijbaan-mobile` (al
opgezet, `lineup.ts` hergebruikt en type-checkt schoon). Belangrijkste
afweging: volledig native geeft net iets meer polish maar kost 2x bouw- en
onderhoudstijd — voor een utility-app (lijsten, formulieren, berekeningen,
geen zware graphics/camera/ML) is dat niet te verantwoorden voor een solo
developer. EAS Build/Submit automatiseert bovendien het grootste deel van
signing/provisioning (zie 9.5).

### 9.2 Backend-hergebruik
- Monorepo: `packages/shared` (types, `lineup.ts`, `clubs.ts`, Supabase-queries)
  geïmporteerd door zowel `apps/web` als `apps/mobile` — stopt met kopiëren
  tussen web en mobile, voorkomt drift.
- Supabase-JS werkt in React Native met een AsyncStorage-adapter i.p.v.
  cookies; zelfde project, zelfde RLS-policies, geen aparte backend nodig.

### 9.3 Monetisatie mobiel — eenmalige aankoop (bijgesteld obv feedback Xander)
Geen abonnement op mobiel — dus geen doorlopende Apple/Google-commissie om
op te volgen en geen renewal-/opzeg-webhooks aan mobiele kant te bouwen.
- **Product:** één non-consumable in-app-aankoop ("Pro" — eenmalig), via
  StoreKit (iOS) en Play Billing (Android). Simpeler dan een abonnement:
  geen subscription groups, geen proration, geen maandelijkse renewal-state.
- **Aanbevolen library:** RevenueCat — valideert de aankoopbon voor beide
  platforms en abstraheert het verschil tussen StoreKit/Play Billing. Voorkomt
  dat je zelf een receipt-validatieserver bouwt.
- **Datamodel:** `profiles.subscription_status` uitbreiden met een losse
  waarde/vlag `pro_lifetime` (naast het bestaande `free`/`pro` voor de
  web-Stripe-maandabonnement) — beide geven dezelfde featuregate, maar de
  bron van waarheid verschilt (Stripe-webhook vs. RevenueCat-webhook).
- **Web blijft ongewijzigd:** Stripe-maandabonnement (€4,99) blijft de
  webflow; dit raakt alleen de mobiele aankoopervaring.
- **Prijs:** kies zelf een eenmalig bedrag (bv. rond 3-4x de maandprijs als
  vuistregel) — dat is een prijsbeslissing die ik niet voor je maak.

### 9.4 Scope v1 (bijgewerkt 29 juli 2026 — Opstelling is uit de webapp gehaald)
~~Opstelling-optimizer + login + eenmalige Pro-aankoop~~ was de oorspronkelijke
scope, gekozen omdat Radar toen nog geen echte polling-laag had. Dat is
inmiddels achterhaald op twee manieren: (1) Radar heeft nu live data over 3
systemen en 112 clubs (§0), en (2) Opstelling bestaat niet meer in de webapp.
**Nieuwe scope v1: Radar** — login + zoekstraal + gevolgde clubs + eenmalige
Pro-aankoop + notificatie-permissie. Geen mock-data meer nodig.

### 9.5 Notificaties
Expo push notifications (`expo-notifications`, Expo Push Token per gebruiker
in Supabase) — Expo routeert zelf naar APNs/FCM, geen losse certificaten
nodig. Telegram-bot blijft naast native push bestaan voor webgebruikers
zonder de app.

### 9.6 Store-vereisten
- Apple Developer Program (\$99/jaar) en Google Play Console (\$25 eenmalig):
  account, identiteit en betaling moet Xander zelf regelen.
- Privacybeleid-URL en data-safety/App Privacy-formulier — content door
  Claude voor te bereiden.
- Dankzij 9.3 (geen abonnement, geen losse betaalprovider in-app) valt de
  zwaarste App Review-categorie (3.1.1 in-app purchase compliance) grotendeels
  weg — wel nog gewoon door StoreKit/Play Billing zelf.
- EAS beheert certificaten/provisioning-profiles/keystores automatisch.

### 9.7 Stappenplan
1. Monorepo opzetten (`packages/shared`, `apps/web`, `apps/mobile`) zonder de
   werkende webapp te breken.
2. Supabase RN-client (AsyncStorage-adapter) toevoegen, login/sessie testen
   in Expo.
3. RevenueCat-account + "Pro"-product (non-consumable) instellen in App Store
   Connect en Play Console.
4. RevenueCat SDK in de Expo-app; bij succesvolle aankoop schrijf naar
   `profiles.pro_lifetime` via een Supabase Edge Function (webhook van
   RevenueCat, niet client-side).
5. Opstelling-scherm afwerken met echte auth + Pro-featuregate.
6. Expo push: permissie-flow + tokenregistratie in Supabase.
7. Xander maakt Apple Developer + Google Play Console account aan; Claude
   bereidt privacybeleid, store-listing teksten en data-safety-antwoorden voor.
8. EAS Build (iOS + Android) → TestFlight / interne Android-testtrack.
9. Store-review indienen.
10. Radar (v2) pas nadat de webkant een echte polling-laag heeft.

## 10. MijnKNLTB-koppeling + vriendenlijst

**Aanleiding:** bij het aanmaken van een account ook MijnKNLTB-gegevens
opvragen, en daaruit voor-/achternaam en speelsterkte overnemen als
beschikbaar — plus een "mijn vrienden"-lijst zodat je bij het samenstellen
van een opstelling niet steeds handmatig spelers hoeft in te typen.

> **Kanttekening (29 juli 2026):** de vriendenlijst was hier gemotiveerd vanuit
> Opstelling ("niet steeds handmatig spelers intypen"). Nu Opstelling uit de
> app is (§0/§4), is dat motief weg. De vriendenlijst kan alsnog waarde hebben
> voor Radar (bv. "we spelen dit weekend, wie kan?"), maar dat is een nieuwe,
> nog niet uitgewerkte reden — niet aannemen dat de oude motivatie nog geldt.

### 10.1 Wat is bevestigd over MijnKNLTB (23 juli 2026, live onderzoek)
- MijnKNLTB draait op `mijnknltb.toernooi.nl` — een instantie van
  **Tournament Software (Visma)**, niet een eigen KNLTB-systeem.
- **Geen publieke API.** Login is een gewoon loginnaam/wachtwoord-formulier.
  De site meldt zelf: "Binnenkort maken we het mogelijk dat je kunt inloggen
  met je KNLTB ID" — dus zelfs OAuth/SSO is er nu nog niet, laat staan een
  ontwikkelaars-API.
- De MijnKNLTB-landingspagina noemt zelf al "Bekijk je statistieken" en
  "**Volg vrienden of je tegenstander**" als functies — het concept
  vriendenlijst sluit dus aan bij wat spelers al kennen uit MijnKNLTB zelf.

### 10.2 Aanpak MijnKNLTB-koppeling — met expliciete risico's
Er is geen nette API-route zoals bij Playtomic/Foys. De enige technische
optie is dezelfde als bij Meet & Play/Overhout: **inloggen namens de
gebruiker en het profiel scrapen** (Playwright, server-side, éénmalig bij
koppelen — geen doorlopende polling nodig, dit hoeft maar één keer per
koppeling/rating-wijziging).

Belangrijke afwegingen, dus niet zomaar te bouwen:
- **Wachtwoorden van een derde partij (KNLTB) opslaan is gevoelig.** Doe dit
  nooit als plaintext-veld in Supabase. Praktisch: gebruik het wachtwoord
  alleen éénmalig om in te loggen, haal naam + speelsterkte op, en gooi het
  wachtwoord daarna weg — bewaar het nooit voor herhaald gebruik. Wil je
  gegevens later kunnen verversen, vraag dan opnieuw in te loggen in plaats
  van het wachtwoord te bewaren.
- **Gebruiksvoorwaarden-risico**: geautomatiseerd inloggen namens gebruikers
  bij een derde partij kan tegen KNLTB/Tournament Software voorwaarden
  ingaan — dit is een bewuste risicoafweging, niet een technisch detail.
  Wees hier transparant over naar gebruikers (expliciete opt-in, uitleg
  waarom en wat je ophaalt) en overweeg juridisch advies voordat dit naar
  productie gaat, zeker als de gebruikersgroep groeit.
- **Fragiliteit**: net als bij Meet & Play kan Tournament Software's
  paginastructuur veranderen — bouw met dezelfde foutafhandelings-aanpak
  (duidelijke fout i.p.v. stil verkeerd resultaat).

## 11. Concurrentie + drie business-beslissingen (29 juli 2026)

*Aangedragen door Xander, uitgewerkt via de business-analyst skill. Aannames
zijn expliciet gemarkeerd — een verzonnen cijfer is erger dan geen cijfer,
want er wordt op besloten.*

### 11.0 Waar staat VrijBaan — concurrentie-check

Xander bracht drie mogelijke concurrenten aan. Ik heb er twee kunnen checken;
**Padelchecker en Hasta La Pista niet** (Play Store-pagina's zijn te
JS-zwaar om te lezen zonder browser) — die twee staan hieronder dus op
Xanders eigen woord, niet op mijn verificatie.

- **ZoekPadel.nl — ZELF GEVERIFIEERD (29 juli 2026, WebFetch).** Live,
  gratis, landelijk: Amsterdam, Rotterdam, Utrecht, Den Haag, Eindhoven,
  Groningen, Tilburg, Almere + "alle steden". Zoekt op plaats/datum/duur over
  meerdere boekingssystemen heen — functioneel bijna hetzelfde uitgangspunt
  als Radar, maar dan al landelijk en al gratis.
- **Padelchecker (ongeverifieerd, bron: Xander)** — Android, claimt 600+
  clubs, Playtomic + Meet & Play + clubspecifiek, meldingen, vrienden
  vergelijken, "10+" downloads. Dit is qua featureset de meest directe
  concurrent van Radar (zelfde 3 systemen + notificaties), maar met "10+"
  downloads lijkt hij net gelanceerd of nog nauwelijks gevonden.
- **Hasta La Pista (ongeverifieerd, bron: Xander)** — breder: banen +
  spelers + wedstrijden + sociale feed, "100+" downloads. Ander
  productconcept (sociaal/matchmaking), minder directe overlap met Radar.

**Conclusie: "banen vergelijken" alleen is geen unieke positie meer** —
ZoekPadel.nl doet dat al, landelijk, gratis, vandaag. Wat Radar er nu
concreet naast heeft, en zij (voor zover bekend) niet: een klikbare
tijd die naar de juiste dag op de juiste boekingssite opent (§0), en
zoeken vanaf een willekeurig adres i.p.v. een vaste stedenlijst. Dat zijn
verbeteringen, geen verdedigbare voorsprong op de lange termijn — een
concurrent kan dat namaken.

**Over de voorgestelde herpositionering ("persoonlijke padelassistent in
WhatsApp")**: mijn eigen verdict is **NOG NIET, niet NEE**. Het idee is
sterk (niemand van de drie doet dit), maar het is een aanzienlijk grotere
bouwklus dan Radar nu is (groepsagenda's combineren, gesprek voeren, state
bijhouden per gebruiker in een chat-interface) — en de epic die dit zou
dragen (Telegram/WhatsApp-notificaties, taak #20) is nog niet eens
end-to-end getest met Telegram alleen. Eerst bewijzen dat mensen zich laten
notificeren en dat converteert naar betalend gebruik, dan pas de grotere
WhatsApp-assistent bouwen — anders bouw je het duurdere idee vóór je weet of
het goedkopere al werkt.

### Optie: commissie per boeking
**Wat**: een vast bedrag of percentage per boeking die via een VrijBaan-link
tot stand komt, betaald door de club (niet de speler).
**Voor wie**: clubs die baat hebben bij extra boekingen via Radar —
vooral kleinere/zelfstandige clubs (Foys/Meet & Play), niet de grote
platforms.
**Waarde (met aannames gemarkeerd)**: *AANNAME — geen echte gebruikscijfers
beschikbaar, VrijBaan heeft nog geen actieve gebruikers.* Als voorbeeld:
500 spelers × 2 boekingen/maand via een gevolgde club = 1.000 boekingen/mnd.
Bij €0,25/boeking = €250/mnd. Bij 1% van een gemiddelde reservering
(~€22,50 voor 60 min/4 spelers) = €0,225/boeking — vergelijkbaar bedrag,
dus de keuze tussen vast bedrag en percentage maakt bij kleine bedragen
weinig verschil.
**Het echte probleem, groter dan het bedrag**: VrijBaan **kan op dit moment
niet vaststellen of een boeking daadwerkelijk heeft plaatsgevonden.** De
"boek hier"-knop (§0) opent een nieuw tabblad naar de site van de club —
daarna gebeurt er niets wat VrijBaan kan zien. Commissie vragen over iets
wat je niet kunt meten is niet uit te leggen aan een club en niet te
verifiëren door VrijBaan. Dit vereist eerst een van drie dingen: (a) een
officiële boekings-API met terugkoppeling (Playtomic Route A, zie
API_REQUIREMENTS.md §1 — bestaat al als optie, nog niet aangevraagd), (b)
een affiliate-/UTM-afspraak per platform (moet je navragen, niet aangenomen
dat dit bestaat), of (c) zelf-gerapporteerde bevestiging door de gebruiker
(zwak, makkelijk te omzeilen).
**Bouwkosten**: klein voor de commissie-logica zelf; groot voor de
attributie (a of b hierboven) — dat laatste is grotendeels buiten mijn hand
als developer (gesprek met de platforms/clubs).
**Afhankelijkheden/risico's**: *AANNAME van Xander, niet geverifieerd*: "bij
Padelverenigingen.nl mag je 5% vragen als er via dat systeem geboekt
wordt" — controleer dit bij de bron zelf voordat je erop rekent, dat kan een
voorwaarde van hún platform zijn, niet iets dat automatisch voor VrijBaan
geldt. Bij Playtomic-schaal (internationaal platform) is een aparte
commissie-afspraak per Nederlandse club onrealistisch — daar zou het via
Route A (officiële API-partner, één afspraak met Playtomic zelf) moeten
lopen, niet per club.
**Hoe je 'm goedkoop test**: vraag het bij 2-3 kleine, zelfstandige clubs na
(niet Playtomic-clubs) of zij een commissie-afspraak voor extra
zichtbaarheid zouden overwegen — vóór er één regel code voor attributie
geschreven wordt.
**Verdict**: **NOG NIET.** Eerst het attributie-probleem oplossen (of
accepteren dat je zonder attributie alleen een symbolische/vrijwillige
bijdrage kunt vragen, geen verplichte commissie). **Dit is aan
marketing/finance om uit te zoeken zodra er credits/tijd voor is** — ik kan
de technische kant (API-koppeling zodra die er is) bouwen, niet de
commerciële afspraak zelf sluiten.

**Positionering-advies (29 juli 2026, via de marketing-campaign-planner
skill — mening/advies, geen onderbouwd feit):**
- **Verkoop geen bestaande zichtbaarheid, verkoop een nieuwe laag erbovenop.**
  VrijBaan toont een club nu al gratis en zonder toestemming (via scraping) —
  een club vragen te betalen voor "zichtbaarheid die ze al hebben" voelt als
  betalen om niet gestraft te worden, en dat is een slechte eerste indruk.
  Een **optionele, echt nieuwe** laag (uitgelicht/bovenaan in de lijst, een
  "geverifieerd"-badge, eigen statistieken over hoe vaak hun club bekeken
  wordt) is een normale freemium-upsell — een commissie op iets wat al
  gratis gebeurde niet.
- **De wachtlijst-clubs (Overhout, Pim Mulier, zie §2) zijn WAARSCHIJNLIJK
  de verkeerde eerste doelgroep voor dit specifieke idee** — dat is een
  belangrijke correctie op de aanname dat "eerste doelgroep" overal hetzelfde
  is. Zij hebben een wachtlijst: hun probleem is te veel vraag, niet te
  weinig. Een pitch "betaal ons om meer boekingen te krijgen" heeft geen
  waarde voor een club die al vol zit. De clubs met een genuine reden om
  voor extra zichtbaarheid te betalen zijn juist de clubs met **rustige
  uren die ze leeg zien staan** (bv. doordeweeks overdag) — dat is een heel
  andere verkooppitch ("vul je stille uren") dan de schaarste-pitch die
  richting spelers werkt.
- **Consent eerst, commissie later.** Voordat er ook maar een betaalvoorstel
  naar een club gaat, verdient het overweging om sowieso proactief contact
  te zoeken met clubs die nu gescraped worden — niet om toestemming te
  vrágen (dat is een juridische vraag, geen marketingvraag), maar om ze niet
  voor het eerst van je bestaan te laten horen via een factuur. Dat bouwt
  het vertrouwen op dat een latere betaalde-laag-pitch nodig heeft.

### Optie: padelscholen-integratie (rooster-API + "boek les"-pagina)
**Wat**: padelscholen melden zich aan (net als clubs via `/club-aanmelden`),
geven op bij welke club(s) ze lesgeven, en maken hun lesrooster zichtbaar —
via een eigen API/webhook (automatisch) of handmatige invoer (simpel, maar
werk voor de school). Een nieuwe pagina toont, net als Radar voor banen,
welke scholen met vrije lesplekken in de buurt zijn, met een "boek les"-knop
(zelfde beperking als bij banen: opent de site van de school, kan niet
voorinvullen — zie §0/`boekingsLink.ts`).
**Voor wie**: spelers die al naar Radar kijken en ook les willen — en
scholen die zichtbaarheid willen zonder zelf een website/app te bouwen.
**Waarom dit FUNDAMENTEEL anders is dan de banen-radar**: bij banen is er
altijd een bestaand boekingssysteem om te scrapen/bevragen (Playtomic, Foys,
Meet & Play) — VrijBaan hoeft de club niet te overtuigen, de data staat er
al publiek. Bij scholen bestaat zo'n publiek systeem meestal niet: een
lesrooster staat vaak in een agenda van de trainer zelf, WhatsApp, of een
losse tool. **VrijBaan kan dit dus niet scrapen — de school moet zelf
pushen.** Dat maakt dit een acquisitie/sales-product (elke school moet
individueel geworven en aangesloten worden), geen scrape-en-klaar-product
zoals Radar. Voor een solo developer is dat een ander soort werk dan
code schrijven.
**Datamodel**: `padelschool_aanmeldingen` (naam, KvK/registratie, welke
club(s), contactgegevens, status — zelfde vorm als `club_aanmeldingen`) +
`padelschool_lesplekken` (school_id, datum, tijd, niveau, plekken vrij,
laatst bijgewerkt) — gevuld via handmatige invoer (MVP) of een eigen
API-endpoint dat scholen kunnen aanroepen (later, zodra er scholen zijn).
**Waarde**: *AANNAME, geen marktcijfer beschikbaar over hoeveel
padelscholen er in Haarlem/regio actief zijn* — dit moet eerst geteld
worden (vergelijkbaar met hoe de 8 clubs in §2 destijds geteld zijn) voordat
er een realistische rekensom te maken is.
**Bouwkosten**: de pagina + datamodel zelf: klein, een paar dagen (volgt het
patroon van club-aanmelden). De acquisitie (scholen werven en aansluiten):
doorlopend, niet eenmalig — dat is het echte werk hierin.
**Hoe je 'm goedkoop test**: 2-3 padelscholen in de Haarlem-regio benaderen
en vragen of ze interesse hebben vóórdat de pagina gebouwd wordt — een
gesprek is goedkoper dan een datamodel + UI die niemand gebruikt.
**Verdict**: **NOG NIET.** Concept is goed en sluit aan bij Radar, maar
bouw eerst de kernpolling stabiel (taak #10/#19) en test met 2-3 scholen of
er animo is, vóór er een tweede databron-type bij komt.

### Optie: prijsoverzicht drie doelgroepen (voorstel, geen besluit)
Xander vroeg om een helder overzicht. Onderstaande bedragen zijn
**voorstellen ter discussie, geen vastgestelde prijzen** — Xander beslist.

| Doelgroep | Model | Voorstel | Onderbouwing |
|---|---|---|---|
| Spelers | Maandabonnement (bestaat al) | €4,99/mnd | Ongewijzigd, staat al in Stripe (§5/README). |
| Verenigingen (zelf aangemeld via `/club-aanmelden`) | Eenmalig | €25–50 eenmalig | Dekt het handmatige verificatiewerk (KvK-check, boekingslink invoeren) — geen doorlopende kosten voor VrijBaan, dus geen abonnement nodig. Auto-ontdekte clubs (Playtomic/Foys-crawl) blijven gratis vermeld — die kosten geen handmatig werk. |
| Padelscholen | Jaarabonnement | €99–199/jaar | Doorlopende zichtbaarheid is een doorlopende dienst (i.t.t. de eenmalige verenigings-verificatie), dus abonnement past beter. Prijs sterk afhankelijk van hoeveel spelers een school realistisch via VrijBaan bereikt — nu niet te onderbouwen (zie schoolintegratie-optie hierboven). |

**Dit raakt nog geen bestaande code**: er is geen Stripe-product voor
verenigingen/scholen, en `/club-aanmelden` vraagt nu geen betaling. Bouwen
zodra Xander een bedrag kiest.

### Landelijk in 1x — wat moet er eerst staan (na de tester skill)
Xander wil na een volledige testronde in één keer heel Nederland bedienen.
Goed nieuws: de overstap naar **beschikbaarheid-op-aanvraag** (§0, 29 juli)
lost het grootste architectuurprobleem al op — Radar pollt nooit meer dan de
~20 clubs die een concrete zoekopdracht oplevert, ongeacht of er landelijk
112 of 1.100 clubs in de database staan. "Landelijk" is dus geen
herontwerp meer, wel drie losse dingen die eerst moeten kloppen:
1. **Databekking**: Playtomic-crawl afmaken (taak #12), Foys is al landelijk
   (26 vestigingen), Meet & Play heeft nog geen landelijke clubdirectory
   (taak #11) — en de aanname "alleen leden" bleek al fout bij Hofgeest, dus
   dit verdient extra prioriteit, niet minder.
2. **De tester-skill-ronde** die Xander zelf als voorwaarde noemt — inclusief
   de nog-niet-geteste stukken: `poll:availability` met echte credentials
   (taak #10), Telegram end-to-end (taak #20).
3. **Iets dat bij regionale schaal nog niet opviel**: bij 8 clubs valt een
   kapotte scraper je meteen op; bij 1.000+ clubs landelijk niet meer — er is
   dan een vorm van monitoring/alerting nodig die zelf meldt wanneer een bron
   stilzwijgend niets (of verkeerd) teruggeeft, anders merk je een kapotte
   koppeling pas als een gebruiker het meldt.

**Aanbeveling:** bouw dit als **optionele** stap ná registratie, niet als
verplicht onderdeel van het aanmaken van een account. Het simpele
alternatief — gebruiker vult zelf naam + speelsterkte in (één getal 1-9) —
blijft de standaard, lage-risico basisflow. De MijnKNLTB-koppeling is een
comfort-upgrade erbovenop ("haal automatisch op" i.p.v. "vul zelf in"), geen
vervanging.

### 10.3 Datamodel
- `profiles` uitbreiden met `voornaam`, `achternaam`, `speelsterkte`
  (nullable — leeg tot handmatig ingevuld of via MijnKNLTB opgehaald) en
  `speelsterkte_bron` (`handmatig` | `mijnknltb`, voor transparantie in de UI).
- Nieuwe tabel `vrienden`: `user_id`, `vriend_user_id`, `status`
  (`pending` | `geaccepteerd`), `aangemaakt_op` — met RLS zodat je alleen je
  eigen vriendschapsrijen (als verzoeker of ontvanger) ziet.
- Opstelling-pagina: naast handmatige spelersinvoer een "kies uit vrienden"-
  optie die naam + speelsterkte automatisch invult vanuit `profiles`.

### 10.4 Stappenplan
1. `profiles`-schema uitbreiden (voornaam/achternaam/speelsterkte/bron) +
   `vrienden`-tabel met RLS, in `supabase/schema.sql`.
2. Vriendenlijst-UI: vriend toevoegen (op e-mail of naam zoeken), verzoek
   accepteren/weigeren, vrienden tonen op een account-subpagina.
3. Opstelling-pagina uitbreiden: spelers kiezen uit vriendenlijst i.p.v.
   alleen handmatig typen (handmatig blijft altijd mogelijk).
4. MijnKNLTB-koppeling als losse, optionele actie ("Koppel MijnKNLTB")
   met duidelijke uitleg + expliciete toestemming, vóór er ook maar iets
   gebouwd wordt aan de eigenlijke login/scrape-stap.
5. Playwright-login-en-scrape-module (`src/lib/scrapers/mijnknltb.ts`),
   zelfde eerlijkheids-aanpak als de andere scrapers: bouwen op basis van
   live devtools-onderzoek van het profielscherm, niet op aannames.
6. Wachtwoord-handling expliciet testen/reviewen voordat dit live gaat —
   dit is de gevoeligste stap in het hele project tot nu toe.
