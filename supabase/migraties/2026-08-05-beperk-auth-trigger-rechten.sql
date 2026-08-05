-- De Auth-trigger wordt alleen intern door Postgres aangeroepen. Voorkom dat
-- anonieme of ingelogde API-clients de SECURITY DEFINER-functie direct zien
-- als aanroepbare RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
