"use client";
import { useEffect, useRef } from "react";
import type { Club } from "@/lib/types";
import "leaflet/dist/leaflet.css";

type ClubMetAfstand = Club & { afstandKm: number };

type Props = {
  clubs: ClubMetAfstand[];
  centrum: { lat: number; lon: number };
};

/**
 * Kaart per stad-pagina (4 aug 2026, Xander: "een googlemaps kaart met
 * daarin de clubs aangegeven ... aanklikbaar om heen te klikken").
 *
 * Gebouwd met Leaflet + OpenStreetMap-tegels, niet de Google Maps
 * JavaScript API: die vereist een eigen Google Cloud-project met
 * facturering en een API-sleutel, en het invoeren van zo'n sleutel is aan
 * Xander zelf (zie de standaardregel over credentials) — dit geeft
 * hetzelfde eindresultaat (interactieve kaart, pin per club, aanklikbaar)
 * zonder die drempel. Wil je liever de echte Google-kaarttegels, zet dan
 * een NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local en zeg het even.
 *
 * Leaflet zelf is niet SSR-veilig (leest meteen `window`/`document`), dus
 * alles hieronder draait bewust pas in een useEffect, met een dynamic
 * import — nooit op modul-niveau.
 */
export default function StadKaart({ clubs, centrum }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let geannuleerd = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (geannuleerd || !containerRef.current) return;

      map = L.map(containerRef.current, {
        center: [centrum.lat, centrum.lon],
        zoom: 12,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers',
        maxZoom: 19,
      }).addTo(map);

      // Padel-bal-icoon in de huisstijl (ball-400) i.p.v. Leaflet's default
      // pin — die default breekt sowieso met Next's bundelaar zonder losse
      // afbeeldingen te kopiëren, en dit sluit meteen aan bij de rest van
      // de app (zelfde geel als BalIcon).
      const balIcon = L.divIcon({
        className: "",
        html:
          '<div style="width:26px;height:26px;border-radius:9999px;background:#cbec27;border:2.5px solid #0b1412;' +
          'box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13],
      });

      const grenzen = L.latLngBounds([]);
      clubs.forEach((club) => {
        const positie: [number, number] = [club.lat, club.lon];
        grenzen.extend(positie);
        const radarLink = `/radar?lat=${club.lat}&lon=${club.lon}&plaats=${encodeURIComponent(club.naam)}&straal=2`;
        const popupHtml = `
          <div style="font-family:inherit;min-width:170px">
            <p style="margin:0;font-weight:600;color:#0f172a">${escapeHtml(club.naam)}</p>
            <p style="margin:2px 0 8px;font-size:12px;color:#64748b">
              ${escapeHtml(club.systeem)}${club.banen > 0 ? ` · ${club.banen} banen` : ""} · ${club.afstandKm} km
            </p>
            <a href="${radarLink}" style="font-size:12px;font-weight:600;color:#0c6e67;text-decoration:underline">
              Bekijk op Radar &rarr;
            </a>
          </div>`;
        L.marker(positie, { icon: balIcon }).addTo(map!).bindPopup(popupHtml);
      });

      if (clubs.length > 1) map.fitBounds(grenzen, { padding: [30, 30] });
    })();

    return () => {
      geannuleerd = true;
      map?.remove();
    };
  }, [clubs, centrum]);

  return (
    <div
      ref={containerRef}
      className="mt-6 h-80 w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm"
      role="img"
      aria-label={`Kaart met ${clubs.length} padelclub${clubs.length === 1 ? "" : "s"}`}
    />
  );
}

// Simpele escape voor tekst die in een HTML-string (Leaflet-popup) belandt —
// clubnamen komen uit onze eigen, vertrouwde data, maar dit voorkomt dat een
// toevallige &/</> ooit de popup-opmaak breekt.
function escapeHtml(tekst: string): string {
  return tekst.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
