import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { haalSocialMediaAdmin } from "@/lib/socialMedia/admin";

/**
 * Voor Navigatie.tsx (5 aug 2026, Xander: "maak voor als je rechten hebt ook
 * een tabblad aan") — geeft alleen het beheerrecht van de ingelogde
 * gebruiker terug, zodat het Beheer-tabblad kan verschijnen.
 *
 * Bevatte eerder ook de voornaam voor een "ingelogd als"-begroeting, maar
 * die is weer verwijderd (5 aug 2026, Xander: "haal alleen de naam weg").
 *
 * Bewust een losse route i.p.v. deze check in layout.tsx/page.tsx: die lezen
 * geen cookies (zie useGebruiker.ts), zodat pagina's statisch blijven.
 * Navigatie (client component) roept dit ná het inloggen zelf aan.
 *
 * isBeheerder hergebruikt haalSocialMediaAdmin() i.p.v. zelf nog een keer de
 * SOCIAL_MEDIA_ADMIN_EMAILS-lijst te controleren — anders kan dit tabblad
 * ooit een ander antwoord geven dan de notFound()-check op
 * /beheer/social-media zelf, en dat mag nooit uiteenlopen. De e-maillijst
 * blijft server-only; hier komt alleen het ja/nee-antwoord uit.
 */
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ingelogd: false });

  const admin = await haalSocialMediaAdmin();
  return NextResponse.json({ ingelogd: true, isBeheerder: admin !== null });
}
