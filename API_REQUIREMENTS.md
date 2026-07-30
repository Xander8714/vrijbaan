# API-vereisten per integratie

## 1. Playtomic

**Geen account nodig voor Route B** (zie onder) — dat was de vraag: je hoeft
niets aan te maken bij Playtomic zelf om te beginnen.

### Tenant_id's gevonden (vandaag, via publieke club-URL — geen devtools nodig)
- **WePadel Haarlem**: `dd28050e-35c4-4bd0-ab58-b2f88111846d`
  (url: playtomic.io/wepadel-haarlem/dd28050e-...)
- **PADEL25 Haarlem**: `68640cb4-c026-4bb1-8184-6e2cfe0f5ccf`
  (url: playtomic.io/indoor-padel25-haarlem/68640cb4-...)
- **Peakz Padel Haarlem** en **Racketclub Overhout** zitten NIET op Playtomic —
  zie §3 en §4 hieronder, opgelost via live Chrome-inspectie (23 juli 2026).

### Route A — Officiële Third Party API
- https://third-party.playtomic.io/ — Bookings/Players/Payments endpoints.
- Vereist een Bearer-token per club, aangemaakt door de club zelf in
  Playtomic Manager → Settings → Developer tools. Vraag dit na bij WePadel
  en PADEL25 zodra je een werkend prototype hebt om te laten zien.

### Route B — Onofficiële `/v1/availability` endpoint — ⚠️ BLIJKT NIET (MEER) TE WERKEN
- `GET https://api.playtomic.io/v1/availability?sport_id=PADEL&start_min=...&start_max=...&tenant_id=...`
- **Update 24 juli 2026 — weerlegd wat hier eerder stond.** Eerder was de
  aanname dat de CloudFront 403 een sandbox-specifiek IP-reputatieblok was.
  Dat is nu getest en weerlegd via een echte Chrome-sessie op een gewone
  (niet-sandbox) verbinding:
  - Directe navigatie naar de endpoint-URL → nog steeds CloudFront 403
    "Request blocked".
  - Een `fetch()` vanuit `playtomic.com` zelf (dus met de juiste
    Referer/Origin) → `TypeError: Failed to fetch` (CORS/WAF-blok, geen
    tijdelijke storing).
  - Playtomic's huidige site draait op **`playtomic.com`** (niet meer
    `.io`), een Next.js-app die beschikbaarheid **server-side** rendert
    (React Server Components, te zien aan `_rsc=`-requests) — de browser
    roept `api.playtomic.io` bij normaal gebruik dus helemaal niet meer aan.
    Het oude, door community-tools (go-playtomic-api, padel-cli)
    gedocumenteerde endpoint is vermoedelijk uitgefaseerd of zit achter een
    strengere WAF.
  - **Conclusie: dit endpoint is op dit moment vanaf geen enkele geteste
    verbinding bruikbaar gebleken.** Niet meer aanbevelen als basis voor de
    Radar-koppeling.
- **Wél bevestigd**: de beschikbaarheidsdata staat gewoon zichtbaar in de
  gerenderde HTML van `playtomic.com/clubs/<slug>` (bv.
  `playtomic.com/clubs/wepadel-haarlem`) — tijden + prijzen, bezette sloten
  doorgestreept. Een Playwright-scraper (zelfde aanpak als Meet & Play:
  pagina laden, grid uitlezen) is dus het realistische alternatief voor
  WePadel/PADEL25, niet de kale fetch-client in `src/lib/scrapers/playtomic.ts`.
  Die module blijft staan als referentie/fallback, met deze bevindingen in
  de docstring.

## 2. KNLTB Meet & Play (Hofgeest, club 29942, en de andere verenigingsclubs)

**Bevestigd via browser-onderzoek (devtools op de Hofgeest-pagina):**
- De site draait op **Laravel Livewire**. Interacties sturen een
  `POST https://meetandplay.nl/livewire/update` met de volledige
  component-snapshot + CSRF-token in de body.
- Dit is GEEN eenvoudige query-parameter-API zoals Playtomic. Een losse
  HTTP-scraper met GET-parameters werkt hier niet betrouwbaar.
- **Aanbevolen aanpak: headless browser (Playwright)**, geen fetch-client.
  Laad de pagina echt, klik op "Padel", wacht op de Livewire-update, lees de
  gerenderde HTML. Zie `src/lib/scrapers/meetandplay.ts` voor het
  interface-contract en `scripts/scrape-meetandplay.ts` voor de werkende
  implementatie.
- Interne club-id wijkt af van de publieke URL-id: Hofgeest is `29942` in de
  URL, maar `clubid-22` in hun documenten-opslag-systeem.

**Geverifieerd end-to-end (23 juli 2026, tegen club 29942):**
- Sportfilter: `select#sportId` (`wire:model.live="tenantSportId"`, `1`=Tennis, `2`=Padel).
- Tijdslots: `input[name="time"]` — `.value` is de starttijd (bv. `"19:00"`).
- **Datumkiezer heeft geen native `<input type="date">`** — het is een
  readonly Pikaday-widget (`wire:ignore`, dus buiten Livewire's DOM-beheer om).
  Pikaday's `onSelect` roept zelf `window.Livewire.find(<wireId>).set('date',
  'DD-MM-YYYY')` aan. Een scraper kan die exacte call in de pagina uitvoeren
  via `page.evaluate()` i.p.v. de kalender-popup te bedienen — stabieler,
  geen maand-navigatie/positionering nodig. `wireId` is te vinden via
  `document.querySelector('#date').closest('[wire\\:id]')`. `minDate` staat
  hardcoded op vandaag; datums in het verleden geeft de site niet vrij.
- **Val om te onthouden bij de polling-laag:** een lege `slots`-array voor
  "vandaag" laat op de avond is een geldig resultaat (na sluitings-/laatste
  boekbare tijd), geen kapotte selector. Verifieer twijfel door dezelfde club
  voor morgen te scrapen — als die wél sloten teruggeeft, werkt de scraper.

## 3. Peakz Padel — "Foys" platform — ✅ WERKEND (29 juli 2026)

**OPGELOST: de kale fetch gaf `[]` omdat twee headers ontbraken.** De
Peakz-frontend stuurt bij élke api.foys.io-call mee:

```
x-organisationid: df82f4dd-fd87-4af5-9c2f-656fe1a44357
x-federationid:   df82f4dd-fd87-4af5-9c2f-656fe1a44357
```

Zonder die headers antwoordt de API **200 met een lege array** — geen 401, geen
foutmelding. Daarom leek het eerder op "niets beschikbaar" in plaats van op een
ontbrekende organisatiecontext. Gevonden door al het api.foys.io-verkeer van
`peakzpadel.nl/reserveren` te onderscheppen met Playwright.

**Endpoints (GET, publiek, mét die twee headers):**
- `/court-booking/public/api/v1/locations` → **26 vestigingen** in heel
  Nederland met adres, stad, `latitude`/`longitude`, `courtsCount` en banen.
- `/court-booking/public/api/v1/locations/search?reservationTypeId=6&playingTimes[]=60&playingTimes[]=90&playingTimes[]=120&date=YYYY-MM-DDT00:00`
  → dezelfde 26 vestigingen, elk met `inventoryItemsTimeSlots[].timeSlots[]`
  (`startTime`, `endTime`, `price`, `duration`, `isAvailable`).
  **De `locationId`-parameter filtert NIET** — je krijgt altijd alles terug.
  `src/lib/scrapers/foys.ts` cachet daarom per datum en filtert zelf, zodat 26
  clubs één HTTP-call per dag kosten in plaats van 26.

**⚠️ CORRECTIE op wat hieronder stond:** `527bd7b9-d8d3-4c43-a2cb-997e5baa0527`
is **Amersfoort - Middelhoefseweg**, niet Haarlem. Haarlem is
`f5b45a7e-3e05-4b86-bb73-8a01dbb27ae9` ("Haarlem - Haarlemmerstroom", 4 banen).

**Deep links:** per vestiging bestaat `peakzpadel.nl/locaties/<stad>/<vestiging>`
(geverifieerd door de links op `/locaties` uit te lezen). Deep-linken via een
query-parameter op de reserveringspagina werkt níet — `?locationId=`,
`?location=` en `?locatie=` geven allemaal weer de stadskiezer.

**Genereren:** `npm run import:foys` → `src/lib/clubs.foys.ts`.

### Oorspronkelijke aantekeningen (23 juli 2026)

Gevonden via live netwerk-inspectie van
`https://www.peakzpadel.nl/reserveren/court-booking/reservation` (niet
Playtomic, niet "Matchable" zoals eerder vermoed).

- `GET https://api.foys.io/court-booking/public/api/v1/locations/search`
  — **200 OK zonder Authorization-header**, dus publiek bereikbaar net als
  Playtomic Route B.
- Query: `reservationTypeId=6` (padel), `locationId=<uuid per vestiging>`,
  herhaalde `playingTimes[]` (60/90/120 min), `date=YYYY-MM-DDT00:00`.
- **Haarlem-locationId: `527bd7b9-d8d3-4c43-a2cb-997e5baa0527`** — bevestigd
  via de locatiekiezer in de reserveringsflow zelf: onder stad "Haarlem"
  staat één vestiging, "Haarlemmerstroom".
- Client: `src/lib/scrapers/foys.ts` — **nog niet geïmplementeerd, wel al
  gedocumenteerd en aangesloten in `pollConfig.ts`/`poll-availability.ts`**
  (gooit bewust een duidelijke fout tot de parser echt gebouwd is).
- ⚠️ Een kale `fetch()` op exact deze URL gaf `[]` terug terwijl de pagina
  op datzelfde moment wél tijdsloten met prijzen toonde — waarschijnlijk mist
  die kale call een header/cookie die de frontend wel meestuurt. Neem de
  exacte request-headers uit de browser-devtools over voordat je de parser
  afmaakt.

## 4. Racketclub Overhout — "Baanreserveren" platform (bevestigd 23 juli 2026)

- Boekingslink op rcoverhout.nl wijst naar `overhout.baanreserveren.nl/reservations`.
- **Vereist inloggen** — geen publieke beschikbaarheid-view: de URL
  redirect direct naar een e-mail/wachtwoord-loginscherm
  (`?reason=LOGGED_IN&goto=%2Freservations`), met alleen een
  "Account aanmaken"-link als alternatief.
- Betekent: geen simpele publieke GET-poll mogelijk zoals bij Playtomic/Foys.
  Voor deze club zou je een echt lidaccount + ingelogde sessie (cookies) nodig
  hebben, wat een ander risicoprofiel geeft (gebruiksvoorwaarden, kans op
  accountblokkade) dan de andere drie systemen. **Nog niet opgenomen in
  `pollConfig.ts`** — bewust, tot hierover een besluit is genomen.

## 2b. Meet & Play — kan een niet-lid boeken? (bevestigd bij Hofgeest, 29 juli 2026)

Belangrijke correctie op een eerdere aanname: Meet & Play is GEEN gesloten
ledensysteem, in elk geval niet bij Hofgeest (club 29942). Geverifieerd via
Playwright (headless, geen ingelogde sessie):
1. Een slot toevoegen aan het winkelmandje (prijs zichtbaar, bv. €20,00 voor
   60 min) vereist geen enkele lidmaatschapscheck.
2. Op "Afrekenen" klikken stuurt naar `meetandplay.nl/inloggen` — dit is een
   **KNLTB ID**, een gratis account op alleen een e-mailadres ("Voer e-mail in,
   druk dan op het pijltje rechts"), zichtbaar op de pagina zelf: "Een KNLTB ID
   is een kosteloze registratie van je gegevens die ervoor zorgt dat je met 1
   mailadres toegang hebt tot Meet & Play en andere KNLTB diensten." Dit is
   geen Hofgeest-lidmaatschap en geen contributie.

**Conclusie voor Hofgeest**: iedereen kan boeken, mits een gratis KNLTB ID.
`src/lib/clubs.ts` zet `boekbaarZonderLidmaatschap: true` voor hofgeest.

**Niet aangenomen voor andere Meet & Play-clubs** (Schoten, Groeneveen, Pim
Mulier): clubs kunnen dit per vestiging anders instellen (bv. baanhuur alleen
voor leden opzetten). Elk apart verifiëren vóór landelijke import.

## 5. Supabase — zie README.md
## 6. Stripe — zie README.md

## Samenvatting: wat te doen in Claude Code
1. ~~Test Route B (Playtomic) tegen WePadel/PADEL25~~ — **getest, blijkt niet
   te werken** (zie §1) vanaf zowel de bouw-sandbox als een echte
   Chrome-sessie op een gewone verbinding. Bouw i.p.v. een fix aan
   `playtomic.ts` een Playwright-scraper voor `playtomic.com/clubs/<slug>`
   (zelfde aanpak als Meet & Play).
2. ~~Zoek uit welk boekingssysteem Peakz en Overhout gebruiken~~ — opgelost
   (zie §3 en §4): Peakz = Foys (publiek endpoint, parser nog te bouwen),
   Overhout = Baanreserveren (login vereist, nog geen besluit over aanpak).
3. ~~Bouw een Playwright-script voor Meet & Play~~ — gedaan, incl.
   datumnavigatie (`scripts/scrape-meetandplay.ts`), end-to-end geverifieerd.
4. Vraag officiële Playtomic-toegang aan (Route A, third-party.playtomic.io)
   als je liever een stabiele, toegestane koppeling wilt dan scrapen — nu
   Route B niet werkt is dit relevanter geworden dan eerder gedacht.
5. ~~Bouw de polling-laag (diff + notificatie) + Supabase-opslag~~ — gedaan
   (`scripts/poll-availability.ts`, `supabase/schema.sql`). Niet zelf getest:
   de Supabase-lees/schrijfcyclus en de Telegram-notificatie (geen
   credentials beschikbaar in de bouw-sandbox).
6. ~~Bouw de Foys-parser af~~ — **gedaan en werkend (29 juli 2026)**: de
   ontbrekende headers (`x-organisationid`/`x-federationid`) waren de oorzaak
   van de lege `[]`-response, zie §3. Levert nu alle 26 vestigingen + prijs
   per slot.
7. Besluit hoe (of of) Overhout meegenomen wordt gezien de inlogmuur (zie
   §4) — **nog open**. Wordt nu getoond als ledenclub (checkbox "ik ben hier
   lid"), niet in de standaardlijst.
8. ~~Vervang `fetchPlaytomicAvailability` door een Playwright-scraper~~ —
   **gedaan (29 juli 2026)**: `scripts/scrape-playtomic.ts`, end-to-end
   geverifieerd tegen WePadel/PADEL25, incl. prijs per slot. De landelijke
   crawl (`scripts/discover-playtomic-clubs.ts`) leverde daarnaast 82
   Playtomic-clubs op (crawl nog niet compleet, zie PROJECTPLAN.md taak
   "Playtomic-crawl afmaken").
9. Meet & Play — prijs per tijdslot nog niet uitgelezen (alleen starttijden).
   Foys en Playtomic tonen al prijs; zie PROJECTPLAN.md taak "Meet & Play
   prijs-extractie bouwen".
10. Meet & Play landelijk: alleen Hofgeest (29942) bekend. **Belangrijke
    correctie (zie §2b)**: de aanname "alleen leden kunnen boeken" bleek fout
    bij Hofgeest — een gratis KNLTB ID volstaat. Niet aannemen dat dit voor
    elke Meet & Play-club geldt; per club verifiëren vóór landelijke import.
