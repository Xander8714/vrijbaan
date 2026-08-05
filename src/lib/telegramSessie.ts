/**
 * Sessiebrug: laat een klik vanuit de Telegram-bot direct een ingelogde
 * Radar-sessie opleveren, zonder los in te loggen op de website (Xander, 3
 * aug 2026: "ik wil vanuit telegram deze meldingen natuurlijk niet meer
 * zien... verzin iets als een sessie").
 *
 * Werkt via een eigen kortlevend, eenmalig token i.p.v. Supabase's
 * magic-link meteen in het Telegram-bericht te zetten — zo staat er nooit
 * een langer geldig inlogmiddel in de chatgeschiedenis (die iemand kan
 * doorsturen of terugvinden), en dwingen we zelf de geldigheidsduur en het
 * eenmalig-gebruik af i.p.v. te vertrouwen op Supabase's eigen (langere,
 * niet hier configureerbare) magic-link-vervaltijd. Het token wordt pas bij
 * het inwisselen (src/app/api/auth/telegram-login/route.ts) omgezet in een
 * echte Supabase-sessie, via hetzelfde `admin.generateLink`-mechanisme dat
 * de wachtwoord-reset-flow ook clientside gebruikt.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import type { RadarOverdrachtData } from "./radarOverdracht";

const TOKEN_GELDIGHEID_MINUTEN = 5;

/** Maakt een eenmalig inlogtoken voor `profielId` en slaat het kort op. */
export async function maakInlogToken(
  admin: SupabaseClient,
  profielId: string,
  radarData?: RadarOverdrachtData
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const verlooptOp = new Date(Date.now() + TOKEN_GELDIGHEID_MINUTEN * 60_000).toISOString();
  const { error } = await admin
    .from("telegram_login_tokens")
    .insert({ token, profile_id: profielId, verloopt_op: verlooptOp, radar_data: radarData ?? null });
  if (error) throw new Error(`Inlogtoken aanmaken mislukt: ${error.message}`);
  return token;
}

/** Bouwt de link die in Telegram-berichten komt: gaat via de sessiebrug i.p.v. rechtstreeks naar `pad`. */
export function bouwSessieLink(siteUrl: string, token: string, pad: string): string {
  return `${siteUrl}/api/auth/telegram-login?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(pad)}`;
}
