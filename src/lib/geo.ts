/**
 * Locatie-rekenwerk voor de landelijke uitbreiding: afstand tussen twee
 * punten en het omzetten van PDOK-antwoorden naar iets waar de app mee kan
 * rekenen.
 *
 * Waarom PDOK (api.pdok.nl/bzk/locatieserver): dit is de officiële
 * Nederlandse locatieservice van het Rijk — gratis, geen API-key, dekt heel
 * Nederland (adressen, straten, woonplaatsen) en mag gebruikt worden. Google
 * Places zou een key + creditcard + gebruikslimieten betekenen voor precies
 * dezelfde informatie.
 *
 * GEVERIFIEERD LIVE (29 juli 2026), beide endpoints met status 200:
 * - Zoeken:  /search/v3_1/free?q=Zijlweg%20Haarlem
 *            → docs[] met `weergavenaam`, `type` ("adres" | "weg" |
 *              "woonplaats"), `centroide_ll` als "POINT(<lon> <lat>)".
 *            LET OP: let op de volgorde — lon staat vóór lat.
 * - Buurt:   /search/v3_1/reverse?lat=52.3874&lon=4.6462&type=woonplaats
 *            → docs[] gesorteerd op afstand, met `afstand` in METERS
 *              (bv. Overveen 1599.57 vanaf Haarlem-centrum).
 *
 * TWEE VERSCHILLENDE AFSTANDSMATEN — niet verwarren (vastgesteld 29 juli 2026):
 * PDOK's `afstand` is de afstand tot de RAND van het gebied, niet tot het
 * middelpunt. Overveen grenst aan Haarlem, dus PDOK meldt 1,6 km, terwijl de
 * twee middelpunten 5,79 km van elkaar liggen (nagerekend met afstandKm).
 * Gevolg: de plaatsen-in-de-buurt-lijst gebruikt PDOK's maat ("een deel van
 * dit dorp ligt binnen je straal") en de clubafstanden gebruiken hemelsbrede
 * middelpunt-tot-middelpunt. Beide zijn verdedigbaar voor hun eigen doel, maar
 * een dorp en een club met "5 km" ernaast zijn dus niet op dezelfde manier
 * gemeten.
 *
 * VAL DIE WE ZELF TEGENKWAMEN (29 juli 2026): PDOK's vrije zoekopdracht
 * matcht fuzzy en geeft bij een niet-bestaand adres stilzwijgend een ánder
 * adres terug — "Reinaldapark 10 Haarlem" leverde "Plesmanplein 10A-533"
 * op. Daarom laat de UI de gebruiker altijd zelf uit de gevonden kandidaten
 * kiezen (`weergavenaam` erbij) i.p.v. automatisch het eerste resultaat te
 * nemen. Nooit stil aannemen dat het eerste resultaat klopt.
 */

export type Coordinaat = { lat: number; lon: number };

export type GevondenLocatie = {
  id: string;
  weergavenaam: string;
  soort: "adres" | "weg" | "woonplaats" | "overig";
  straatnaam?: string;
  woonplaatsnaam?: string;
  postcode?: string;
} & Coordinaat;

export type PlaatsInBuurt = {
  woonplaatsnaam: string;
  weergavenaam: string;
  afstandKm: number;
} & Coordinaat;

const AARDRADIUS_KM = 6371;

/**
 * PDOK geeft coördinaten als WKT-punt: "POINT(4.61973571 52.38599139)".
 * Eerst lengte- dan breedtegraad — omgekeerd t.o.v. hoe wij ze noemen.
 * Geeft null bij een onverwachte vorm, zodat de aanroeper kan besluiten dat
 * resultaat over te slaan i.p.v. met NaN verder te rekenen.
 */
export function parseCentroideLl(wkt: string | undefined | null): Coordinaat | null {
  if (!wkt) return null;
  const match = /^POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/.exec(wkt.trim());
  if (!match) return null;
  const lon = Number(match[1]);
  const lat = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/** Hemelsbrede afstand in kilometers (haversine). */
export function afstandKm(a: Coordinaat, b: Coordinaat): number {
  const naarRad = (graden: number) => (graden * Math.PI) / 180;
  const dLat = naarRad(b.lat - a.lat);
  const dLon = naarRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(naarRad(a.lat)) * Math.cos(naarRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * AARDRADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Afronden op 1 decimaal — genoeg precisie voor "8,3 km" in de UI. */
export function afgerondeAfstand(a: Coordinaat, b: Coordinaat): number {
  return Math.round(afstandKm(a, b) * 10) / 10;
}

/**
 * Sorteert items met coördinaten op afstand vanaf een punt en filtert op een
 * maximale straal. Generiek gehouden zodat zowel clubs als woonplaatsen er
 * door kunnen zonder hun eigen sorteerlogica te hoeven hebben.
 */
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

/**
 * Zoekt een straat, adres of woonplaats via de PDOK Locatieserver — gedeeld
 * door /api/adres-zoeken (de Radar/Account-zoekvelden) en de Telegram-bot
 * (2 aug 2026, natuurlijke-taal-zoekopdrachten), zodat er niet twee keer
 * dezelfde PDOK-aanroep + parsing bestaat. Zie de moduledocstring hierboven
 * voor waarom PDOK en de valkuilen (fuzzy matching, lon vóór lat).
 */
export async function zoekLocatiesPdok(q: string, rows = 8): Promise<GevondenLocatie[]> {
  const url = new URL(PDOK_FREE);
  url.searchParams.set("q", q);
  // Alleen soorten waar een zinvol middelpunt bij hoort: een compleet adres,
  // een straat, of een woonplaats. Provincies/gemeenten laten we weg omdat
  // hun middelpunt te grof is om een straal vanaf te rekenen.
  url.searchParams.set("fq", "type:(adres OR weg OR woonplaats)");
  url.searchParams.set("rows", String(rows));
  url.searchParams.set("fl", "id,type,weergavenaam,straatnaam,woonplaatsnaam,postcode,centroide_ll");

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`PDOK gaf ${res.status} ${res.statusText} — locatiezoeken is nu niet beschikbaar.`);
  }
  const data = (await res.json()) as { response?: { docs?: PdokDoc[] } };
  const docs = data.response?.docs ?? [];

  // Documenten zonder bruikbaar middelpunt slaan we over in plaats van ze
  // met NaN-coördinaten door te geven.
  return docs.flatMap((doc) => {
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
}

export function binnenStraal<T extends Coordinaat>(
  items: T[],
  vanaf: Coordinaat,
  straalKm: number
): (T & { afstandKm: number })[] {
  return items
    .map((item) => ({ ...item, afstandKm: afgerondeAfstand(vanaf, item) }))
    .filter((item) => item.afstandKm <= straalKm)
    .sort((a, b) => a.afstandKm - b.afstandKm);
}
