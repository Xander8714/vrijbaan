# Socialmedia-publisher uitrollen

Deze branch bevat de organische Instagram/Facebook-publicatieworker. Er is
vanuit Codex bewust niets gecommit, gepusht, gemigreerd of op de VPS geactiveerd.

## Bekende zakelijke Meta-assets

- Meta-app: `2159057097990501`
- Business: `1185999173741266`
- Facebook-pagina `devrijebaan`: `1225916397274389`
- Instagram `devrijebaan`: `17841441308305794`
- Meta System User-token: nog veilig aanmaken en alleen op de VPS opslaan

De advertentiebeperking van Instagram staat los van deze integratie. Voeg geen
advertentierechten toe. Nodig voor organisch publiceren:
`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
`instagram_basic` en `instagram_content_publish`.

## Veilige uitrolvolgorde

1. Controleer en commit alleen de bedoelde wijzigingen. Laat lokale
   `.claude/settings.local.json` buiten Git.
2. Pas `supabase/migraties/2026-08-05-social-media-publicatie.sql` toe op
   Supabase-project `ojyrvpxrnfdnuvmteiwq`.
3. Maak in Meta Business een System User, wijs app en Facebook-pagina toe en
   genereer een niet-verlopende System User-token met uitsluitend de
   bovenstaande organische rechten. De worker leidt het Page Access Token
   automatisch af; bewaar dus de System User-token op de VPS.
4. Zet de drie geheime/zakelijke waarden in `/opt/vrijebaan/.env.local`:

   ```env
   META_ACCESS_TOKEN=...
   META_FACEBOOK_PAGE_ID=1225916397274389
   META_INSTAGRAM_ACCOUNT_ID=17841441308305794
   META_GRAPH_API_VERSION=v26.0
   SOCIAL_MEDIA_BUCKET=social-media
   SOCIAL_MEDIA_WORKER_ID=vrijebaan-vps
   ```

5. Deploy de applicatie, maar activeer de timer nog niet.
6. Voer op de VPS `npm run social:meta-check` uit. Dit claimt of publiceert geen
   databasepost.
7. Controleer dat `command -v npm` overeenkomt met `ExecStart` in de service.
   Installeer daarna de twee units uit `scripts/systemd/`, voer
   `sudo systemctl daemon-reload` uit en activeer
   `vrijebaan-social-publish.timer`.
8. Volg de eerste run met:

   ```bash
   systemctl status vrijebaan-social-publish.timer
   journalctl -u vrijebaan-social-publish.service -n 100 --no-pager
   ```

De worker verwerkt maximaal vijf verschuldigde posts per minuut. Hij publiceert
geen `pending_approval`-concepten. Bij een succesvolle publicatie verschijnen
de Meta-post-id's en het live-tijdstip in `/beheer/social-media`.

## Reeds uitgevoerde lokale controles

- `npm test`: 10 bestanden, 92 tests geslaagd
- `npx tsc --noEmit`: geslaagd
- `npm run lint`: geen fouten; drie reeds bestaande waarschuwingen elders
- `npm run build`: geslaagd met Next.js 16.2.11
