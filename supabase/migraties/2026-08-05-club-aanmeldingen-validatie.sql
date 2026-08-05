-- Verplaatst de "vul minstens KvK-nummer of verenigingsregistratie in"-regel
-- van client-side JS (club-aanmelden/page.tsx, regel ~49) naar een echte
-- database-constraint (5 aug 2026, security-assessment: "Insert-policy
-- club_aanmeldingen lijkt te ruim" — de policy zelf (with_check: true,
-- rol public) is bewust zo: dit is een publiek aanmeldformulier zonder
-- inlogmuur, iedereen mag een club voordragen. Maar de enige échte regel die
-- de app eraan stelt bestond alleen in de React-form en was dus net zo
-- makkelijk te omzeilen als de policy zelf via een rechtstreekse API-call.
--
-- status blijft buiten deze migratie: die heeft al een DEFAULT 'nieuw' en
-- wordt nooit door het formulier meegestuurd, dus dat kanaal is al veilig.
alter table public.club_aanmeldingen
  add constraint club_aanmeldingen_clubnaam_niet_leeg
    check (char_length(trim(clubnaam)) > 0 and char_length(clubnaam) <= 200),
  add constraint club_aanmeldingen_contact_naam_niet_leeg
    check (char_length(trim(contact_naam)) > 0 and char_length(contact_naam) <= 200),
  add constraint club_aanmeldingen_contact_email_formaat
    check (contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(contact_email) <= 320),
  add constraint club_aanmeldingen_verificatie_verplicht
    check (coalesce(trim(kvk_nummer), '') <> '' or coalesce(trim(vereniging_registratie), '') <> '');
