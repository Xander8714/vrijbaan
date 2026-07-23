# Projectplan: Padel Radar Haarlem + Opstelling-tool

**Datum:** 19 juli 2026
**Status:** Concept — klaar om te bouwen
**Auteur:** Xander (met onderzoek/uitwerking via Claude)

---

## 1. Het probleem

Padel groeit in Nederland harder dan het aanbod aan banen: 876.000 spelers in 2025, banen +25%, maar spelersaantal groeit sneller. Gevolg: wachtlijsten en volle clubs, vooral in dichtbevolkte regio's. Daarbovenop is het boekingslandschap versnipperd — spelers hebben 2-3 apps nodig (Playtomic voor commerciële clubs, KNLTB Meet & Play voor verenigingen) en beschikbaarheid is vaak alleen binnen een beperkt tijdvenster zichtbaar.

Daarnaast: teams die meedoen aan de KNLTB-competitie (7.400+ teams landelijk) moeten elke speelronde zelf hun koppel-opstelling bepalen — op basis van afnemende speelsterkte — zonder hulpmiddel om dit datagedreven te doen.

Twee losse problemen, één regionale app om mee te beginnen, met een landelijk uitbreidbaar tweede feature.

---

## 2. Regio-scope: Haarlem + 5 km

| Club | Plaats | Banen | Systeem | Status (2026) |
|------|--------|-------|---------|----------------|
| Racketclub Overhout | Haarlem | — | Playtomic (vermoedelijk) | Vol, wachtlijst dicht |
| TPV Pim Mulier | Haarlem | — | Meet & Play (vereniging) | Ledenstop senioren, wachtlijst heropend |
| WePadel Haarlem | Haarlem | 8 | Playtomic (vermoedelijk) | Grootste outdoor club van NL |
| Peakz Padel Haarlem | Haarlem | — | Playtomic (vermoedelijk) | — |
| PADEL25 Haarlem | Haarlem | — | Playtomic (vermoedelijk) | — |
| Schoten Tennis & Padel | Haarlem | — | Meet & Play (vereniging) | — |
| LTC Hofgeest | Velserbroek | 3 | Meet & Play (vereniging) | — |
| LTC Groeneveen | Santpoort-Noord (Driehuis+5km) | 10 | Meet & Play (vereniging) | — |

**Totaal: 8 locaties, ~47 banen.** De twee wachtlijst-clubs (Overhout, Pim Mulier) zijn je beste bron voor de eerste testgebruikers — die mensen zoeken nu al actief naar een plek.

*Let op: bovenstaande systeem-toewijzing (Playtomic vs. Meet & Play) is een aanname op basis van commercieel vs. vereniging. Eerste technische stap is dit per club te verifiëren.*

---

## 3. Feature 1 — Beschikbaarheid-notifier (MVP)

**Wat het doet:** monitort vrije padel-slots bij de 8 clubs en stuurt een melding (WhatsApp of push) zodra een slot vrijkomt dat past bij de voorkeur van de gebruiker (club, dag, tijdvak).

**Waarom dit werkt:** lost een acuut, actueel probleem op (schaarste + versnippering) voor een doelgroep die je nu al kunt aanspreken via je eigen padelnetwerk en de wachtlijsten.

**Technisch:**
- Twee databronnen: Playtomic (heeft een halfopen API die veel tools al gebruiken) en KNLTB Meet & Play (waarschijnlijk alleen te scrapen, geen publieke API — moet uitgezocht worden).
- Polling-service die periodiek (bv. elke 5-10 min) beschikbaarheid ophaalt en vergelijkt met vorige stand → bij nieuw vrij slot: trigger notificatie.
- Notificatiekanaal: begin met een simpele Telegram-bot of push (makkelijker te bouwen dan WhatsApp Business API, geen goedkeuringsproces nodig). WhatsApp kan later als upgrade.
- Gebruikersvoorkeuren: club(s), dagen, tijdvak, eventueel maximale prijs.

**Risico's:**
- Scrapen van Meet & Play kan tegen gebruiksvoorwaarden ingaan of instabiel zijn (site-structuur kan veranderen) — bouw dit met foutafhandeling en monitoring.
- Playtomic kan rate-limits hanteren — niet te vaak pollen.

**Monetisatie:** freemium (bv. 1 gratis club volgen, 3 meldingen per week) → €2,50-5/mnd voor onbeperkt volgen van meerdere clubs/tijden.

**Eerste gebruikers:** eigen club/vriendengroep in Haarlem + gerichte outreach naar de wachtlijsten van Overhout en Pim Mulier (bijv. via de clubs zelf vragen of je een berichtje mag plaatsen).

---

## 4. Feature 2 — Team-opstelling optimizer

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
- Welk boekingssysteem gebruiken Peakz Padel Haarlem en Racketclub Overhout?
  Niet gevonden op Playtomic — "Matchable" kwam naar voren voor Peakz, nog te bevestigen.

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
- **Playtomic-client (`src/lib/scrapers/playtomic.ts`) is NIET live
  geverifieerd**: `api.playtomic.io` gaf in de sandbox waarin dit gebouwd is
  op elk pad (ook root `/`) een CloudFront 403 "Request blocked", terwijl
  `playtomic.io` zelf gewoon bereikbaar was — vermoedelijk een IP-reputatie-
  blok op dat sandbox-netwerk, geen probleem met de query zelf. Draai
  `npm run poll:availability` een keer vanaf een gewone (niet-datacenter)
  verbinding en vergelijk de ruwe JSON met de types in dat bestand voordat je
  hierop vertrouwt.
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

### 9.4 Scope v1
Opstelling-optimizer + login + eenmalige Pro-aankoop + notificatie-permissie
alvast regelen. Radar volgt in v2, zodra de webkant een echte polling-laag
heeft (zie §8) — anders bouw je nu een mobiel scherm op mock-data dat je
straks toch overdoet.

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
