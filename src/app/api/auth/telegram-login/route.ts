import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Wisselt een eenmalig Telegram-sessietoken (src/lib/telegramSessie.ts) in
 * voor een echte ingelogde sessie. Gebruikt Supabase's server-side
 * `admin.generateLink` (magiclink) — hetzelfde onderliggende mechanisme als
 * de wachtwoord-reset-pagina, die ook puur uit een URL-token een sessie
 * opbouwt, alleen dan clientside via e-mail i.p.v. hier via Telegram.
 *
 * Lukt het niet (token onbekend/verlopen/al gebruikt, of geen e-mailadres
 * bekend bij het account) dan valt de gebruiker terug op de kale
 * (uitgelogde) link — zoeken op de Radar werkt sowieso zonder account, dus
 * dit mag nooit een doodlopend pad worden.
 */
export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vrijbaan.vercel.app";

function veiligPad(pad: string | null): string {
  // Alleen een relatief pad toestaan. Zonder deze check zou `redirect`
  // gebruikt kunnen worden voor een open-redirect: een link die via ons
  // eigen, vertrouwde domein naar een phishing-site doorstuurt.
  if (!pad || !pad.startsWith("/") || pad.startsWith("//")) return "/radar";
  return pad;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const redirectPad = veiligPad(req.nextUrl.searchParams.get("redirect"));
  const kaleTerugval = NextResponse.redirect(new URL(redirectPad, SITE_URL));

  if (!token) return kaleTerugval;

  const admin = supabaseAdmin();

  // Atomisch opeisen: token moet bestaan, nog niet verlopen en nog niet
  // gebruikt zijn. `gebruikt_op` wordt in dezelfde UPDATE gezet i.p.v. eerst
  // te lezen en dan te updaten — zo kan een dubbele klik (of iemand die de
  // link doorstuurt vlak nadat de eerste klik hem al verbruikte) het token
  // nooit twee keer opeisen.
  const nu = new Date().toISOString();
  const { data: opgeeist, error: opeisFout } = await admin
    .from("telegram_login_tokens")
    .update({ gebruikt_op: nu })
    .eq("token", token)
    .is("gebruikt_op", null)
    .gt("verloopt_op", nu)
    .select("profile_id")
    .maybeSingle();

  if (opeisFout || !opgeeist) return kaleTerugval;

  const { data: gebruikerData, error: gebruikerFout } = await admin.auth.admin.getUserById(opgeeist.profile_id);
  const email = gebruikerData?.user?.email;
  if (gebruikerFout || !email) return kaleTerugval;

  const { data: link, error: linkFout } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: new URL(redirectPad, SITE_URL).toString() },
  });
  if (linkFout || !link?.properties?.action_link) return kaleTerugval;

  return NextResponse.redirect(link.properties.action_link);
}
