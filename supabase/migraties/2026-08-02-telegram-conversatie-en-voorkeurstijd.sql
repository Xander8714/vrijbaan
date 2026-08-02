-- Conversatie-state voor de Telegram-bot + voorkeurstijd voor meldingen op
-- basis van locatie (2 augustus 2026). Uitbreiding op de Fase 1-koppeling
-- (2026-07-30-telegram-koppeling.sql): de bot vraagt na het koppelen actief
-- "waar?" en "hoe laat?" i.p.v. dat de gebruiker dit op de website invult.
--
-- telegram_onboarding_stap: op welke vraag de bot een antwoord verwacht.
-- null = geen actief gesprek (normale toestand).
alter table profiles add column if not exists telegram_onboarding_stap text
  check (telegram_onboarding_stap is null or telegram_onboarding_stap in (
    'wacht_locatie_onboarding', 'wacht_tijd_onboarding', 'wacht_locatie_adhoc'
  ));

-- Tijdelijke opslag van PDOK-locatiekandidaten tussen het sturen van een
-- plaatsnaam en het kiezen van een inline-keyboard-knop in. Telegram's
-- callback_data heeft een lengtelimiet, dus we kunnen de kandidaten niet
-- direct in de knop meesturen — alleen een index ernaar.
alter table profiles add column if not exists telegram_kandidaten jsonb;

-- Voorkeurstijd voor padellen, apart van de Radar-voorkeurstijd (die leeft
-- alleen client-side/per bezoek). Dit is de PERSISTENTE voorkeur die de
-- achtergrond-poller gebruikt om te bepalen of een nieuw slot de moeite
-- waard is om over te melden. Leeg = geen voorkeur, elk nieuw slot binnen de
-- straal is dan meldenswaardig.
alter table profiles add column if not exists voorkeurstijd text
  check (voorkeurstijd is null or voorkeurstijd ~ '^([01]\d|2[0-3]):[0-5]\d$');

-- Geen nieuwe RLS-policy nodig: "eigen profiel" (auth.uid() = id) dekt deze
-- kolommen al. De webhook schrijft via de service-role key (buiten RLS om),
-- zoals de rest van src/app/api/telegram/webhook al doet.
