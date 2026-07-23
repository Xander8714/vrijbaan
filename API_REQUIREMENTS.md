# API-vereisten per integratie

## 1. Playtomic

**Geen account nodig voor Route B** (zie onder) — dat was de vraag: je hoeft
niets aan te maken bij Playtomic zelf om te beginnen.

### Tenant_id's gevonden (vandaag, via publieke club-URL — geen devtools nodig)
- **WePadel Haarlem**: `dd28050e-35c4-4bd0-ab58-b2f88111846d`
  (url: playtomic.io/wepadel-haarlem/dd28050e-...)
- **PADEL25 Haarlem**: `68640cb4-c026-4bb1-8184-6e2cfe0f5ccf`
  (url: playtomic.io/indoor-padel25-haarlem/68640cb4-...)
- **Peakz Padel Haarlem**: NIET gevonden op Playtomic — mogelijk een ander
  systeem ("Matchable" kwam naar voren in zoekresultaten). Nader onderzoek nodig.
- **Racketclub Overhout**: NIET gevonden op Playtomic. Nader onderzoek nodig —
  mogelijk eigen boekingssysteem via rcoverhout.nl.

### Route A — Officiële Third Party API
- https://third-party.playtomic.io/ — Bookings/Players/Payments endpoints.
- Vereist een Bearer-token per club, aangemaakt door de club zelf in
  Playtomic Manager → Settings → Developer tools. Vraag dit na bij WePadel
  en PADEL25 zodra je een werkend prototype hebt om te laten zien.

### Route B — Onofficiële `/v1/availability` endpoint
- `GET https://api.playtomic.io/v1/availability?sport_id=PADEL&start_min=...&start_max=...&tenant_id=...`
- **Bevestigd: geen authenticatie nodig.** Max 25 uur per request.
- Met de twee tenant_id's hierboven kun je dit vandaag al testen voor WePadel
  en PADEL25, zonder een account aan te maken.

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

## 3. Supabase — zie README.md
## 4. Stripe — zie README.md

## Samenvatting: wat te doen in Claude Code
1. Test Route B (Playtomic) meteen tegen WePadel/PADEL25 met de tenant_id's
   hierboven — geen account nodig.
2. Zoek uit welk boekingssysteem Peakz en Overhout gebruiken.
3. ~~Bouw een Playwright-script voor Meet & Play~~ — gedaan, incl.
   datumnavigatie (`scripts/scrape-meetandplay.ts`). Nog open: koppelen aan
   polling-laag + database (zie PROJECTPLAN.md §6).
4. Vraag officiële Playtomic-toegang aan zodra je een werkend prototype hebt.
