# VrijBaan

Padel-app voor Haarlem + 5 km: beschikbaarheid-radar over 8 clubs (Playtomic +
KNLTB Meet & Play) en een opstelling-optimizer voor KNLTB-competitieteams.

## Starten (zonder Supabase/Stripe)
```bash
npm install
npm run dev
```
Alles werkt meteen met mock-data; login/betalen tonen nette meldingen i.p.v. te crashen.

## Volledige functionaliteit (login, opslaan, betalen)
1. Gratis project op supabase.com, keys in `.env.local` (kopieer `.env.example`).
2. Voer `supabase/schema.sql` uit in de Supabase SQL editor.
3. Stripe test-account, product "VrijBaan Pro", keys in `.env.local`.
4. Lokaal webhook testen: `stripe listen --forward-to localhost:3000/api/webhook`.

## Docker
```bash
docker compose up
```

## Tests
```bash
npm test
```
9 unit tests op `src/lib/lineup.ts`.

## Mobiel
PWA (`public/manifest.json`) — "Toevoegen aan beginscherm" op je telefoon.
Native app: zie `vrijbaan-mobile/` (Expo), test via Expo Go — geen Apple-account nodig.

## Live boekingsdata — status
Zie `API_REQUIREMENTS.md` voor de volledige uitleg. Kort: Playtomic tenant_id's
voor WePadel en PADEL25 zijn gevonden (staan in dit bestand als `clubs.ts`
commentaar); Meet & Play (Hofgeest) draait op Laravel Livewire en vereist een
headless-browser aanpak (`src/lib/scrapers/meetandplay.ts`), geen losse fetch.
Peakz en Overhout zijn nog niet bevestigd op Playtomic.

## Gebruikerstesten
Zie `USER_TESTING.md`.

## Meet & Play scraper (Playwright)

`scripts/scrape-meetandplay.ts` haalt echte beschikbaarheid op bij Meet & Play
clubs (Hofgeest e.a.) door de pagina als een echte browser te bedienen —
nodig omdat de site op Laravel Livewire draait, niet op een publieke API.

**Eenmalig lokaal instellen:**
```bash
npx playwright install chromium
```
(Kon in mijn sandbox niet gedownload worden door een netwerk-allowlist —
zou bij jou lokaal gewoon moeten werken.)

**Draaien:**
```bash
npm run scrape:meetandplay -- 29942
```
Print de beschikbare starttijden voor vandaag bij Hofgeest (club 29942) als JSON.

**Nog open:** datumnavigatie (welke UI-elementen de datum wijzigen is nog niet
gevonden — vermoedelijk een custom widget, geen native date input), en het
resultaat wegschrijven naar de database i.p.v. alleen naar console.
