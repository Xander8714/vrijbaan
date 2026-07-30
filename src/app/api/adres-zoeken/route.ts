import { NextRequest, NextResponse } from "next/server";
import { parseCentroideLl, type GevondenLocatie } from "@/lib/geo";

// Server-side proxy naar de PDOK Locatieserver. Waarom niet direct uit de
// browser: PDOK stuurt geen CORS-headers voor willekeurige origins, en zo
// houden we de exacte query-vorm (die fuzzy matcht, zie geo.ts) op één plek.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PDOK_FREE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

type PdokDoc = {
  id?: string;
  type?: string;
  weergavenaam?: string;
  straatnaam?: string;
  woonplaatsnaam?: string;
  postcode?: string;
  centroide_ll?: string;
};

function naarSoort(type: string | undefined): GevondenLocatie["soort"] {
  if (type === "adres" || type === "weg" || type === "woonplaats") return type;
  return "overig";
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Geef minimaal 2 tekens op om te zoeken." }, { status: 400 });
  }

  const url = new URL(PDOK_FREE);
  url.searchParams.set("q", q);
  // Alleen soorten waar een zinvol middelpunt bij hoort: een compleet adres,
  // een straat, of een woonplaats. Provincies/gemeenten laten we weg omdat
  // hun middelpunt te grof is om een straal vanaf te rekenen.
  url.searchParams.set("fq", "type:(adres OR weg OR woonplaats)");
  url.searchParams.set("rows", "8");
  url.searchParams.set(
    "fl",
    "id,type,weergavenaam,straatnaam,woonplaatsnaam,postcode,centroide_ll"
  );

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `PDOK gaf ${res.status} ${res.statusText} — locatiezoeken is nu niet beschikbaar.` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { response?: { docs?: PdokDoc[] } };
    const docs = data.response?.docs ?? [];

    // Documenten zonder bruikbaar middelpunt slaan we over in plaats van ze
    // met NaN-coördinaten door te geven — zie parseCentroideLl.
    const resultaten: GevondenLocatie[] = docs.flatMap((doc) => {
      const punt = parseCentroideLl(doc.centroide_ll);
      if (!punt) return [];
      return [
        {
          id: doc.id ?? `${doc.weergavenaam}-${punt.lat},${punt.lon}`,
          weergavenaam: doc.weergavenaam ?? "Onbekende locatie",
          soort: naarSoort(doc.type),
          straatnaam: doc.straatnaam,
          woonplaatsnaam: doc.woonplaatsnaam,
          postcode: doc.postcode,
          ...punt,
        },
      ];
    });

    return NextResponse.json({ resultaten });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
