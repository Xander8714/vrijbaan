import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { veiligInternPad } from "@/lib/authNavigatie";

/**
 * Vangt de terugkeer van een OAuth-provider (nu: Google) op. Supabase's eigen
 * callback (https://<project>.supabase.co/auth/v1/callback, geregistreerd bij
 * Google) wisselt de Google-code al in en stuurt de browser hierheen door met
 * een eigen `code` — dat wisselen we hier nogmaals in, nu voor een sessie op
 * ÓNS domein (cookies op devrijebaan.nl, niet op supabase.co). Zie
 * src/app/login/page.tsx voor waar deze flow start.
 */
export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vrijbaan.vercel.app";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const nextPad = veiligInternPad(req.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(nextPad, SITE_URL));
  }

  // Geen code, of het inwisselen mislukte (verlopen/al gebruikt) — terug naar
  // inloggen met een zichtbare melding i.p.v. stilzwijgend op een kale pagina
  // belanden.
  return NextResponse.redirect(new URL("/login?fout=oauth", SITE_URL));
}
