-- Sluit de kolom-vrije kant van de "eigen profiel"-RLS-policy op profiles af
-- (5 aug 2026, gevonden bij een security-assessment door Xander en
-- onafhankelijk geverifieerd: policy "eigen profiel", cmd ALL,
-- qual (auth.uid() = id), with_check null — Postgres hergebruikt qual als
-- WITH CHECK voor INSERT/UPDATE, dus die policy beperkt WELKE RIJ je mag
-- aanraken, maar niet WELKE KOLOMMEN. Een ingelogde gebruiker kon zichzelf
-- daardoor via een gewone client-call Pro maken:
--   supabase.from("profiles").update({subscription_status:"pro"}).eq("id", eigenId)
-- en kon stripe_customer_id zetten naar een willekeurige waarde, wat de
-- customer.subscription.deleted-afhandeling in api/webhook/route.ts (die
-- matcht op stripe_customer_id) kan laten mismatchen.
--
-- Fix: kolom-privileges (Postgres-native, los van RLS) i.p.v. de policy zelf
-- herschrijven — een RLS WITH CHECK kan geen "deze kolom mag niet veranderen"
-- uitdrukken zonder een dure oude-waarde-lookup; een kolomwhitelist via
-- REVOKE/GRANT wél, en de database weigert een schrijfactie op een
-- niet-toegestane kolom hard, ongeacht wat de policy zegt.
--
-- De whitelist hieronder is het volledige, geverifieerde overzicht van
-- kolommen die de site zelf client-side beschrijft (ProfielFormulier.tsx,
-- radar/page.tsx "Bewaar zoekgebied", TelegramKoppelen.tsx) — niet geraden.
-- subscription_status, stripe_customer_id, created_at, last_seen_at,
-- telegram_onboarding_stap, telegram_kandidaten en voorkeurstijd blijven
-- expres buiten de whitelist: die worden uitsluitend server-side
-- (supabaseAdmin()/service_role, dat deze grants sowieso omzeilt) beschreven
-- door de Stripe-webhook of de Telegram-webhook.
--
-- authenticated ÉN anon aangepast voor consistentie, al blokkeert de
-- bestaande RLS-policy (auth.uid() = id) anon toch al volledig — anon had
-- nooit een werkende schrijfweg op deze tabel, dus dit kan niets breken.
revoke insert, update on public.profiles from authenticated, anon;

grant insert (
  id, email, voornaam, achternaam, speelsterkte, speelsterkte_bron,
  bondsnummer, telefoon, straat, huisnummer, postcode, woonplaats,
  lat, lon, zoekstraal_km, lidmaatschappen
) on public.profiles to authenticated;

grant update (
  id, email, voornaam, achternaam, speelsterkte, speelsterkte_bron,
  bondsnummer, telefoon, straat, huisnummer, postcode, woonplaats,
  lat, lon, zoekstraal_km, lidmaatschappen, telegram_koppel_code,
  telegram_chat_id
) on public.profiles to authenticated;
