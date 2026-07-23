/**
 * Playtomic beschikbaarheid via de onofficiële `/v1/availability` endpoint
 * (Route B uit API_REQUIREMENTS.md).
 *
 * ⚠️ BIJGEWERKT 24 juli 2026 — NIET MEER ALLEEN EEN SANDBOX-PROBLEEM:
 * eerder stond hier dat de CloudFront 403 "Request blocked" waarschijnlijk
 * een IP-reputatieblok was, specifiek voor de bouw-sandbox. Dat is nu
 * weerlegd: dezelfde 403 trad ook op via een normale Chrome-sessie op een
 * gewone (niet-sandbox) verbinding, zowel bij directe navigatie naar de
 * endpoint-URL als bij een `fetch()` vanuit de Playtomic-site zelf
 * (`TypeError: Failed to fetch`, wat op een CORS/WAF-blok wijst, niet op een
 * tijdelijke storing).
 *
 * Waarschijnlijke oorzaak: Playtomic's publieke site draait inmiddels op
 * `playtomic.com` (een Next.js-rewrite, andere domeinnaam dan het oude
 * `playtomic.io`) en haalt beschikbaarheid **server-side** op (React Server
 * Components, te zien aan `_rsc=`-requests) — de browser roept
 * `api.playtomic.io` dus zelf helemaal niet meer aan. Het oude,
 * community-gedocumenteerde endpoint lijkt daarmeeofwel uitgefaseerd, ofwel
 * inmiddels achter een strengere WAF te zitten die alle directe verkeer blokt.
 *
 * **Praktische conclusie:** dit endpoint is op dit moment NIET bruikbaar
 * gebleken, vanaf geen enkele geteste verbinding. De beschikbaarheidsdata
 * zelf staat wel gewoon zichtbaar in de HTML van `playtomic.com/clubs/...`
 * (bevestigd via screenshot) — een Playwright-scraper zoals
 * `scripts/scrape-meetandplay.ts` (laad de pagina, lees de gerenderde grid)
 * is daarom het realistische alternatief, niet een kale fetch-client zoals
 * hieronder. Bewaar deze module als referentie/fallback mocht Playtomic het
 * endpoint ooit weer openzetten, maar bouw de Radar-koppeling voor
 * WePadel/PADEL25 niet hierop totdat dat zo is.
 */

export type PlaytomicSlot = {
  startTime: string; // "HH:MM"
  resourceId: string;
  duration: number; // minuten
};

type PlaytomicApiResource = {
  resource_id: string;
  start_date: string;
  slots: { start_time: string; duration: number; price?: string }[];
};

export async function fetchPlaytomicAvailability(
  tenantId: string,
  datum: string // YYYY-MM-DD
): Promise<PlaytomicSlot[]> {
  const url = new URL("https://api.playtomic.io/v1/availability");
  url.searchParams.set("sport_id", "PADEL");
  url.searchParams.set("start_min", `${datum}T00:00:00`);
  url.searchParams.set("start_max", `${datum}T23:59:59`);
  url.searchParams.set("tenant_id", tenantId);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Playtomic availability-call mislukt: ${res.status} ${res.statusText} (${url})`);
  }

  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(
      "Onverwachte Playtomic-response (geen array) — de response-vorm is mogelijk " +
        "veranderd sinds dit geschreven werd. Zie de docstring in dit bestand."
    );
  }

  return (data as PlaytomicApiResource[]).flatMap((resource) =>
    (resource.slots ?? []).map((slot) => ({
      startTime: slot.start_time.slice(0, 5),
      resourceId: resource.resource_id,
      duration: slot.duration,
    }))
  );
}
