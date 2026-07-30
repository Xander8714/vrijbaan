-- Telefoonnummer voor toekomstige notificaties (SMS/WhatsApp), optioneel.
-- Al toegepast op de live database via de Supabase MCP (29/30 juli 2026) —
-- dit bestand is de documentatie/het record daarvan, zelfde patroon als de
-- vorige migratie in deze map.
--
-- Formaat: genormaliseerd naar +31 6 XXXXXXXX (E.164-achtig, Nederlands
-- mobiel) door de client vóór het opslaan — zie src/lib/telefoon.ts. De
-- check hieronder is een laatste, servergezijdige garantie, geen vervanging
-- van de klantvalidatie (die moet ook duidelijke foutmeldingen geven).
alter table profiles add column if not exists telefoon text check (telefoon is null or telefoon ~ '^\+316\d{8}$');
