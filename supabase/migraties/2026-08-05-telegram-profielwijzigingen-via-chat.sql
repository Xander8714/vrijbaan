-- Uitbreiding van de Telegram-bot (5 aug 2026): profiel aanpassen via vrije
-- tekst in de chat (straal, tijd, locatie, vaste speelmomenten), naast de
-- bestaande onboarding- en zoekflows. Zie src/lib/telegramConversatie.ts en
-- src/app/api/telegram/webhook/route.ts.
--
-- Locatie wijzigen kon tot nu toe alleen tijdens de onboarding
-- (wacht_locatie_onboarding) of een losse zoekopdracht (wacht_locatie_adhoc).
-- "verander mijn locatie naar Leiden" buiten die twee flows om heeft een
-- eigen stap nodig, die dezelfde inline-locatiekeuze hergebruikt maar zonder
-- de rest van de onboarding of een zoekopdracht te starten.
alter table profiles drop constraint if exists profiles_telegram_onboarding_stap_check;
alter table profiles add constraint profiles_telegram_onboarding_stap_check
  check (telegram_onboarding_stap is null or telegram_onboarding_stap in (
    'wacht_locatie_onboarding', 'wacht_tijd_onboarding', 'wacht_locatie_adhoc', 'wacht_locatie_profiel'
  ));

-- Geen nieuwe kolommen nodig voor straal/tijd (bestaande zoekstraal_km/
-- voorkeurstijd) of "favoriete dagen" (de bestaande vaste_speelmomenten-tabel
-- uit 2026-08-03-vaste-speelmomenten.sql, dag+tijd samen — bewust GEEN losse
-- favoriete_dagen-kolom toegevoegd, dat zou een tweede, ongebruikt
-- dagen-concept naast vaste_speelmomenten zijn geweest).
