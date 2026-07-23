import { Club } from "./types";

// Startregio: Haarlem + 5 km (Velserbroek, Driehuis/Santpoort-Noord)
// Playtomic tenant_id's zijn geverifieerd via de publieke club-URL (staat
// letterlijk in de URL-slug, geen devtools nodig). Overhout en Peakz zijn
// op 23 juli 2026 geverifieerd via live Chrome-inspectie (zie API_REQUIREMENTS.md):
// Overhout draait op "Baanreserveren" (BR) achter een inlogmuur, Peakz op
// het "Foys" boekingsplatform met een publiek GET-endpoint.
export const CLUBS: Club[] = [
  { id: "overhout", naam: "Racketclub Overhout", plaats: "Haarlem", banen: 5, systeem: "Baanreserveren", status: "Bevestigd — overhout.baanreserveren.nl, LET OP: /reservations vereist inloggen (geen publieke beschikbaarheid-view)", boekingsUrl: "https://overhout.baanreserveren.nl/reservations" },
  { id: "pim-mulier", naam: "TPV Pim Mulier", plaats: "Haarlem", banen: 4, systeem: "Meet & Play", status: "Ledenstop senioren — wachtlijst heropend" },
  { id: "wepadel", naam: "WePadel Haarlem", plaats: "Haarlem", banen: 8, systeem: "Playtomic", status: "Grootste outdoor club van NL — tenant_id dd28050e-35c4-4bd0-ab58-b2f88111846d", boekingsUrl: "https://playtomic.io/wepadel-haarlem/dd28050e-35c4-4bd0-ab58-b2f88111846d" },
  { id: "peakz", naam: "Peakz Padel Haarlem", plaats: "Haarlem", banen: 4, systeem: "Foys", status: "Bevestigd — api.foys.io publieke GET-API, locationId 527bd7b9-d8d3-4c43-a2cb-997e5baa0527", boekingsUrl: "https://www.peakzpadel.nl/reserveren/court-booking/reservation" },
  { id: "padel25", naam: "PADEL25 Haarlem", plaats: "Haarlem", banen: 4, systeem: "Playtomic", status: "Actief — tenant_id 68640cb4-c026-4bb1-8184-6e2cfe0f5ccf", boekingsUrl: "https://playtomic.io/indoor-padel25-haarlem/68640cb4-c026-4bb1-8184-6e2cfe0f5ccf" },
  { id: "schoten", naam: "Schoten Tennis & Padel", plaats: "Haarlem", banen: 4, systeem: "Meet & Play", status: "Actief" },
  { id: "hofgeest", naam: "LTC Hofgeest", plaats: "Velserbroek", banen: 3, systeem: "Meet & Play", status: "Actief — Meet & Play club 29942, draait op Laravel Livewire", boekingsUrl: "https://meetandplay.nl/club/29942" },
  { id: "groeneveen", naam: "LTC Groeneveen", plaats: "Santpoort-Noord (Driehuis)", banen: 10, systeem: "Meet & Play", status: "Actief" },
];
// pim-mulier, schoten, groeneveen: Meet & Play-club-id nog niet bevestigd, dus (nog) geen boekingsUrl.
