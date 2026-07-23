import { NextRequest, NextResponse } from "next/server";
import { zoekKnltbSpeelsterkte, zoekKnltbSpelers } from "@/lib/scrapers/knltb";

// Draait Playwright (headless Chromium) — vereist de Node.js-runtime, niet Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const bondsnummer = request.nextUrl.searchParams.get("bondsnummer");
  const q = request.nextUrl.searchParams.get("q");

  try {
    if (bondsnummer) {
      const resultaat = await zoekKnltbSpeelsterkte(bondsnummer);
      return NextResponse.json(resultaat);
    }
    if (q) {
      const resultaten = await zoekKnltbSpelers(q);
      return NextResponse.json({ resultaten });
    }
    return NextResponse.json({ error: "Geef 'bondsnummer' of 'q' op." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
