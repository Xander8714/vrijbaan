/**
 * Playtomic beschikbaarheid via de onofficiële `/v1/availability` endpoint
 * (Route B uit API_REQUIREMENTS.md — geen authenticatie nodig volgens de
 * reverse-engineering bronnen daar, max. 25 uur per request).
 *
 * ⚠️ ONGEVERIFIEERD IN DEZE SANDBOX (23 juli 2026): api.playtomic.io geeft
 * hier op elk pad — ook de root `/` — een CloudFront 403 "Request blocked",
 * terwijl playtomic.io zelf (marketing-site, andere CloudFront-distributie)
 * gewoon bereikbaar is. Dat wijst op een IP-reputatie/WAF-blok op dit
 * sandbox-netwerk, geen fout in deze query. De response-vorm hieronder is
 * gebaseerd op de in API_REQUIREMENTS.md genoemde community-projecten
 * (go-playtomic-api, padel-cli), NIET zelf live bevestigd. Draai
 * `npm run poll:availability` een keer vanaf een normale (niet-datacenter)
 * verbinding en vergelijk de ruwe JSON met de types hieronder voordat je
 * hierop vertrouwt in productie.
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
