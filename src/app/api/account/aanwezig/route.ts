import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ fout: "Niet ingelogd" }, { status: 401 });

  // Upsert is tegelijk een vangnet voor historische accounts waarvan de
  // Auth-trigger ooit geen profielrij heeft aangemaakt.
  const { error } = await supabaseAdmin().from("profiles").upsert({
    id: user.id,
    email: user.email,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (error) {
    console.error("Aanwezigheid bijwerken is mislukt", error.message);
    return NextResponse.json({ fout: "Aanwezigheid niet bijgewerkt" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
