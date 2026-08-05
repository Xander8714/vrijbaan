import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { isRadarOverdrachtData } from "@/lib/radarOverdracht";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Geeft uitsluitend aan de ingelogde eigenaar de kortlevende meting terug die
 * de Telegram-bot zojuist al heeft uitgevoerd. De scrapers draaien hier niet.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Ongeldige Radar-overdracht." }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Log opnieuw in om deze meting te openen." }, { status: 401 });
  }

  const nu = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("telegram_login_tokens")
    .select("radar_data")
    .eq("token", token)
    .eq("profile_id", user.id)
    .not("gebruikt_op", "is", null)
    .gt("verloopt_op", nu)
    .maybeSingle();

  if (error) {
    console.error("[radar-overdracht] Lezen mislukt:", error.message);
    return NextResponse.json({ error: "De klaargezette meting kon niet worden geopend." }, { status: 500 });
  }
  if (!data || !isRadarOverdrachtData(data.radar_data)) {
    return NextResponse.json({ error: "Deze klaargezette meting is verlopen." }, { status: 404 });
  }

  return NextResponse.json(data.radar_data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
