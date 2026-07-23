import { Club } from "./types";

// Startregio: Haarlem + 5 km (Velserbroek, Driehuis/Santpoort-Noord)
// Playtomic tenant_id's zijn geverifieerd via de publieke club-URL (staat
// letterlijk in de URL-slug, geen devtools nodig). Peakz en Overhout zijn
// NIET bevestigd op Playtomic — nader onderzoek nodig (zie API_REQUIREMENTS.md).
export const CLUBS: Club[] = [
  { id: "overhout", naam: "Racketclub Overhout", plaats: "Haarlem", banen: 5, systeem: "Playtomic", status: "Boekingssysteem NIET bevestigd — geen Playtomic-pagina gevonden, nader onderzoek nodig" },
  { id: "pim-mulier", naam: "TPV Pim Mulier", plaats: "Haarlem", banen: 4, systeem: "Meet & Play", status: "Ledenstop senioren — wachtlijst heropend" },
  { id: "wepadel", naam: "WePadel Haarlem", plaats: "Haarlem", banen: 8, systeem: "Playtomic", status: "Grootste outdoor club van NL — tenant_id dd28050e-35c4-4bd0-ab58-b2f88111846d" },
  { id: "peakz", naam: "Peakz Padel Haarlem", plaats: "Haarlem", banen: 4, systeem: "Playtomic", status: "Boekingssysteem NIET bevestigd — mogelijk 'Matchable' i.p.v. Playtomic, nader onderzoek nodig" },
  { id: "padel25", naam: "PADEL25 Haarlem", plaats: "Haarlem", banen: 4, systeem: "Playtomic", status: "Actief — tenant_id 68640cb4-c026-4bb1-8184-6e2cfe0f5ccf" },
  { id: "schoten", naam: "Schoten Tennis & Padel", plaats: "Haarlem", banen: 4, systeem: "Meet & Play", status: "Actief" },
  { id: "hofgeest", naam: "LTC Hofgeest", plaats: "Velserbroek", banen: 3, systeem: "Meet & Play", status: "Actief — Meet & Play club 29942, draait op Laravel Livewire" },
  { id: "groeneveen", naam: "LTC Groeneveen", plaats: "Santpoort-Noord (Driehuis)", banen: 10, systeem: "Meet & Play", status: "Actief" },
];
