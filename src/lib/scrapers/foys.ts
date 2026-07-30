/**
 * Foys — het boekingsplatform van Peakz Padel (26 vestigingen in Nederland).
 *
 * ✅ WERKEND EN GEVERIFIEERD LIVE (29 juli 2026). Hiervoor stond hier een stub
 * die altijd gooide, met de aantekening dat een kale `fetch()` op
 * `locations/search` `[]` teruggaf terwijl de pagina wél sloten toonde.
 *
 * DE OORZAAK, gevonden door al het api.foys.io-verkeer van
 * peakzpadel.nl/reserveren te onderscheppen met Playwright: de frontend stuurt
 * twee headers mee die de kale fetch miste:
 *     x-organisationid: df82f4dd-fd87-4af5-9c2f-656fe1a44357
 *     x-federationid:   df82f4dd-fd87-4af5-9c2f-656fe1a44357
 * Zonder die headers antwoordt de API 200 met een lege array — geen foutcode,
 * dus het lijkt op "niets beschikbaar" in plaats van op een ontbrekende
 * organisatiecontext. Dat is precies waarom dit eerder verkeerd gelezen is.
 * Met de headers erbij geeft dezelfde URL alle 26 vestigingen met tijdsloten.
 *
 * ⚠️ CORRECTIE OP EERDERE DOCUMENTATIE: API_REQUIREMENTS.md §3 noemde
 * `527bd7b9-d8d3-4c43-a2cb-997e5baa0527` als de Haarlem-locationId. Dat is
 * onjuist — dat id is **Amersfoort - Middelhoefseweg**. Haarlem
 * ("Haarlem - Haarlemmerstroom", 4 banen) is
 * `f5b45a7e-3e05-4b86-bb73-8a01dbb27ae9`. Bevestigd via /v1/locations.
 *
 * ENDPOINTS (alle GET, publiek, mét de twee headers hierboven):
 * - `/court-booking/public/api/v1/locations`
 *      → 26 vestigingen met adres, stad, latitude/longitude, courtsCount en
 *        hun banen. Dit is de bron voor de landelijke clublijst.
 * - `/court-booking/public/api/v1/locations/search?reservationTypeId=6
 *      &playingTimes[]=60&playingTimes[]=90&playingTimes[]=120&date=<ISO>T00:00`
 *      → dezelfde 26 vestigingen, elk met `inventoryItemsTimeSlots[].timeSlots[]`
 *        met `startTime`, `endTime`, `price`, `duration` en `isAvailable`.
 *      → LET OP: de `locationId`-parameter filtert NIET; je krijgt altijd alle
 *        vestigingen terug. Daarom cachet dit bestand het antwoord per datum en
 *        filtert het zelf op locatie — anders zou de polling-job dezelfde
 *        megabytes 26 keer per dag ophalen.
 */

const FOYS_BASIS = "https://api.foys.io/court-booking/public/api/v1";
const ORGANISATIE_ID = "df82f4dd-fd87-4af5-9c2f-656fe1a44357";
const RESERVERING_TYPE_PADEL = 6;

const FOYS_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "x-organisationid": ORGANISATIE_ID,
  "x-federationid": ORGANISATIE_ID,
};

export type FoysSlot = { startTime: string; duurMinuten: number; prijs: number; baan: string };

export type FoysLocatie = {
  id: string;
  naam: string; // displayName, bv. "Haarlem - Haarlemmerstroom"
  stad: string;
  adres: string;
  postcode: string;
  lat: number;
  lon: number;
  banen: number;
};

type FoysApiTimeSlot = {
  startTime: string; // "2026-07-30T08:00:00"
  endTime: string;
  price: number;
  duration: number;
  isAvailable: boolean;
};

type FoysApiLocatie = {
  id: string;
  displayName?: string;
  name?: string;
  city?: string;
  address1?: string;
  houseNumber?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  courtsCount?: number;
  inventoryItemsTimeSlots?: { name?: string; timeSlots?: FoysApiTimeSlot[] }[];
};

/** Alle Peakz-vestigingen met coördinaten — bron voor de landelijke clublijst. */
export async function fetchFoysLocaties(): Promise<FoysLocatie[]> {
  const res = await fetch(`${FOYS_BASIS}/locations`, { headers: FOYS_HEADERS });
  if (!res.ok) {
    throw new Error(`Foys /locations gaf ${res.status} ${res.statusText}.`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Onverwachte Foys-response op /locations (geen array).");
  }
  return (data as FoysApiLocatie[]).flatMap((l) => {
    if (typeof l.latitude !== "number" || typeof l.longitude !== "number") return [];
    return [
      {
        id: l.id,
        naam: l.displayName ?? l.name ?? "Peakz Padel",
        stad: l.city ?? "",
        adres: [l.address1].filter(Boolean).join(" "),
        postcode: l.zipCode ?? "",
        lat: l.latitude,
        lon: l.longitude,
        banen: l.courtsCount ?? 0,
      },
    ];
  });
}

// Eén HTTP-call per datum bedient alle vestigingen (zie docstring). De cache
// leeft binnen één proces — precies goed voor scripts/poll-availability.ts, dat
// per run alle clubs × dagen langsgaat en dan afsluit.
const cachePerDatum = new Map<string, Promise<FoysApiLocatie[]>>();

function haalDagOp(datum: string): Promise<FoysApiLocatie[]> {
  const bestaand = cachePerDatum.get(datum);
  if (bestaand) return bestaand;

  const url = new URL(`${FOYS_BASIS}/locations/search`);
  url.searchParams.set("reservationTypeId", String(RESERVERING_TYPE_PADEL));
  for (const duur of ["60", "90", "120"]) url.searchParams.append("playingTimes[]", duur);
  url.searchParams.set("date", `${datum}T00:00`);

  const belofte = (async () => {
    const res = await fetch(url, { headers: FOYS_HEADERS });
    if (!res.ok) {
      throw new Error(`Foys /locations/search gaf ${res.status} ${res.statusText} voor ${datum}.`);
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      throw new Error("Onverwachte Foys-response op /locations/search (geen array).");
    }
    return data as FoysApiLocatie[];
  })();

  cachePerDatum.set(datum, belofte);
  return belofte;
}

/**
 * Vrije padel-sloten bij één Peakz-vestiging op één dag.
 *
 * Alleen `isAvailable: true` komt terug — de API stuurt ook alle bezette sloten
 * mee, en die als "vrij" doorgeven zou de hele radar waardeloos maken.
 */
export async function fetchFoysAvailability(
  locationId: string,
  datum: string
): Promise<FoysSlot[]> {
  const locaties = await haalDagOp(datum);
  const locatie = locaties.find((l) => l.id === locationId);
  if (!locatie) {
    throw new Error(
      `Foys kent locationId ${locationId} niet (${locaties.length} vestigingen ontvangen). ` +
        "Controleer het id via fetchFoysLocaties()."
    );
  }

  return (locatie.inventoryItemsTimeSlots ?? []).flatMap((baan) =>
    (baan.timeSlots ?? [])
      .filter((slot) => slot.isAvailable)
      .map((slot) => ({
        // "2026-07-30T08:00:00" → "08:00"
        startTime: slot.startTime.slice(11, 16),
        duurMinuten: slot.duration,
        prijs: slot.price,
        baan: baan.name ?? "",
      }))
  );
}
