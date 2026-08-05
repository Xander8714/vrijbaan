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
   Voeg voor het afgeschermde socialmediabeheer ook `SOCIAL_MEDIA_ADMIN_EMAILS`
   toe als komma-gescheiden allowlist. Zonder deze variabele blijft
   `/beheer/social-media` voor iedereen gesloten.
2. Voer `supabase/schema.sql` én de bestanden in `supabase/migraties/` uit in
   de Supabase SQL editor (in datumvolgorde).
3. Stripe test-account, product "VrijeBaan Pro", keys in `.env.local`.
4. Lokaal webhook testen: `stripe listen --forward-to localhost:3000/api/webhook`.

## Socialmedia-agent (goedkeuringsmodus)

`npm run social:generate -- --dry-run` selecteert actuele beschikbaarheid en
toont het concept zonder iets op te slaan. Zonder `--dry-run` wordt maximaal
één concept met status `pending_approval` opgeslagen. Beoordelen en plannen
gebeurt via `/beheer/social-media`; alleen e-mailadressen uit
`SOCIAL_MEDIA_ADMIN_EMAILS` hebben toegang. De bestaande introductiepost geldt
als nummer 1. `npm run social:plan-launch` plant de vier resterende launchposts
idempotent om de drie dagen in goedkeuringsmodus.

Na goedkeuring publiceert `npm run social:publish` verschuldigde posts
organisch op Instagram en Facebook. De worker rendert de vaste SVG-huisstijl
naar publieke 1080x1080-JPEG's in de Supabase Storage-bucket `social-media`,
publiceert via de Meta Graph API en bewaart per platform het externe post-id.
Een atomaire databaseclaim voorkomt dubbele verwerking door gelijktijdige
workers. Tijdelijke fouten krijgen begrensde retries; een onduidelijke fout op
de definitieve Meta-publish-call wordt bewust niet automatisch herhaald.

Voor de Meta-koppeling zijn op de worker nodig:

```env
META_GRAPH_API_VERSION=v26.0
META_ACCESS_TOKEN=<niet-verlopende System User-token>
META_FACEBOOK_PAGE_ID=<numeriek pagina-id>
META_INSTAGRAM_ACCOUNT_ID=<numeriek professioneel Instagram-account-id>
SOCIAL_MEDIA_BUCKET=social-media
SOCIAL_MEDIA_WORKER_ID=vrijebaan-vps
```

Gebruik uitsluitend een zakelijke Meta System User met toegang tot de pagina
en app. De worker leidt daar per run het vereiste Page Access Token uit af; sla
dus de System User-token op, niet een handmatig gekopieerd paginatoken. Voor
organisch publiceren zijn `pages_show_list`,
`pages_read_engagement`, `pages_manage_posts`, `instagram_basic` en
`instagram_content_publish` nodig; advertentierechten zijn niet nodig. Zet het
token nooit in een `NEXT_PUBLIC_`-variabele of in Git. Controleer de koppeling
zonder een post te claimen met:

```bash
npm run social:meta-check
```

Op de VPS kunnen de meegeleverde units uit `scripts/systemd/` worden geplaatst
in `/etc/systemd/system/`. Activeer pas na een geslaagde `social:meta-check` de
timer met `sudo systemctl enable --now vrijebaan-social-publish.timer`. De timer
controleert elke minuut; alleen goedgekeurde posts zonder gepland tijdstip en
geplande posts waarvan het tijdstip verstreken is, worden gepubliceerd.

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
