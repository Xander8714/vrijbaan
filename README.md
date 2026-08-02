# VrijeBaan

Padel-beschikbaarheid-radar voor Nederland: zoek op adres/plaats, stel een
straal in en zie live vrije baantijden — mét prijs — bij clubs op Playtomic,
Foys (Peakz) en KNLTB Meet & Play. Begonnen in Haarlem, inmiddels landelijk
(112+ clubs). Er is geen aparte opstelling-tool meer — dit is nu één product:
de beschikbaarheid-radar. Zie `PROJECTPLAN.md` voor de volledige geschiedenis
en openstaande beslissingen.

## Starten (zonder Supabase/Stripe)
```bash
npm install
npm run dev
```
Alles werkt meteen; login/betalen tonen nette meldingen i.p.v. te crashen.

## Volledige functionaliteit (login, opslaan, betalen)
1. Gratis project op supabase.com, keys in `.env.local` (kopieer `.env.example`).
2. Voer `supabase/schema.sql` én de bestanden in `supabase/migraties/` uit in
   de Supabase SQL editor (in datumvolgorde).
3. Stripe test-account, product "VrijeBaan Pro", keys in `.env.local`.
4. Lokaal webhook testen: `stripe listen --forward-to localhost:3000/api/webhook`.

## Docker
```bash
docker compose up
```

## Tests
```bash
npm test
```
44 unit tests (vitest) over `src/lib/__tests__/*` — lineup-rekenmodel,
adres/straal-berekening (`geo.ts`), tijdvenster-matching (`tijd.ts`),
beschikbaarheid-diff en boekingslinks.

## Mobiel
PWA (`public/manifest.json`) — "Toevoegen aan beginscherm" op je telefoon.
Native app: zie `vrijbaan-mobile/` (Expo, nog vroeg — scope is de Radar, niet
de verwijderde opstelling-tool, zie PROJECTPLAN.md §9.4).

## Live boekingsdata — status
Zie `API_REQUIREMENTS.md` voor de volledige technische uitleg per systeem.
Kort: alle drie systemen werken end-to-end en zijn live geverifieerd —
Playtomic en Meet & Play via een Playwright-scraper (headless browser, de
sites hebben geen bruikbare publieke API), Foys (Peakz, 26 vestigingen) via
een publiek GET-endpoint. Beschikbaarheid wordt **op aanvraag** opgehaald
voor de clubs die een gebruiker na filteren daadwerkelijk ziet (max. 20
clubs per zoekopdracht) — niet doorlopend gepolld, dat zou bij honderden
clubs veel te lang duren. `scripts/poll-availability.ts` (de losse
polling-job voor notificaties) bestaat wel, maar is nog niet end-to-end
getest met echte Supabase/Telegram-credentials.

## Gebruikerstesten
Zie `USER_TESTING.md`.

## Scrapers (Playwright)

Twee bronnen draaien via een headless browser omdat er geen stabiele
publieke API is:
```bash
npm run scrape:meetandplay -- 29942 2026-07-30   # Meet & Play, club-id + optionele datum
npx tsx scripts/scrape-playtomic.ts wepadel-haarlem 2026-07-30  # Playtomic, club-slug + optionele datum
```
**Eenmalig lokaal instellen:** `npx playwright install chromium`

## Diagnose: wat is er nu beschikbaar?
```bash
npm run check -- Haarlem 10 2026-07-30 12:00 2
#                plaats  km  datum      tijd  marge-in-uren
```
Print per club binnen de straal wat er op die dag rond die tijd vrij is —
zonder iets naar Supabase te schrijven. Handig om te controleren of alle
scrapers nog werken.

## Landelijke clubdata verzamelen
```bash
npm run discover:playtomic -- 400   # crawlt Playtomic-clubpagina's, schrijft src/lib/clubs.playtomic.ts
npx tsx scripts/import-foys-clubs.ts # haalt alle Foys/Peakz-vestigingen op
```

## Projectskills
Zie `.claude/skills/` — `developer` (codeconventies van dit repo),
`tester` (hoe je een wijziging hier verifieert) en `business-analyst`
(commerciële/product-afwegingen tot beslisklare opties uitwerken).
