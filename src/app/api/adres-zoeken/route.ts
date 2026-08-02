import { NextRequest, NextResponse } from "next/server";
import { zoekLocatiesPdok } from "@/lib/geo";

// Server-side proxy naar de PDOK Locatieserver. Waarom niet direct uit de
// browser: PDOK stuurt geen CORS-headers voor willekeurige origins, en zo
// houden we de exacte query-vorm (die fuzzy matcht, zie geo.ts) op één plek.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Geef minimaal 2 tekens op om te zoeken." }, { status: 400 });
  }

  try {
    const resultaten = await zoekLocatiesPdok(q);
    return NextResponse.json({ resultaten });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
