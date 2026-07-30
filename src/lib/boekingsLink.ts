import type { Club } from "./types";

/**
 * Bepaalt waar een gebruiker heen moet om een gekozen tijd te boeken, en hoeveel
 * van die keuze we in de link kunnen meegeven.
 *
 * WAT WEL EN NIET KAN — geverifieerd 29 juli 2026, niet aangenomen:
 * - Playtomic: `playtomic.com/clubs/<slug>?date=YYYY-MM-DD` opent de juiste dag.
 *   Bevestigd doordat de pagina bij `?date=2026-07-30` overal "do 30 jul" toont.
 *   Een link naar een specifieke TIJD bestaat niet: de slots zijn geen <a
 *   href>, het boeken gebeurt client-side. Bij een DOM-scan op alle links met
 *   book/reserv/checkout/datum in de href kwamen alleen lidmaatschap-betaallinks
 *   en links naar andere clubs terug — geen per-slot URL.
 * - Foys/Peakz: deep-linken werkt helemaal niet. `?locationId=`, `?location=` en
 *   `?locatie=` op de reserveringspagina geven allemaal weer de stadskiezer.
 *   Daarom sturen we naar de vestigingspagina
 *   (`peakzpadel.nl/locaties/<stad>/<vestiging>`), die wél de juiste locatie is.
 * - Meet & Play: de datum zit niet in de URL maar in een Livewire-aanroep
 *   (`Livewire.find(...).set('date', ...)`), dus vanuit een link niet te zetten.
 *
 * WAAROM WE DE GEGEVENS VAN DE GEBRUIKER NIET MEESTUREN: een webpagina kan geen
 * formulier op een ander domein invullen — de browser verbiedt dat (same-origin
 * policy), en dat is precies de bedoeling. Voorinvullen kan alleen als de club
 * ons een officiële boekings-API met OAuth geeft (Playtomic Route A, zie
 * API_REQUIREMENTS.md §1). Tot die tijd is het eerlijkste wat we kunnen doen:
 * de juiste pagina op de juiste dag openen en de gebruiker precies vertellen —
 * en laten kopiëren — wat hij daar moet invullen.
 */

export type BoekingsBestemming = {
  url: string;
  /** Zit de gekozen datum al in de link, of moet de gebruiker die zelf kiezen? */
  datumInUrl: boolean;
  /** Zit de gekozen tijd al in de link? (nergens ondersteund, zie docstring) */
  tijdInUrl: boolean;
  /** Wat de gebruiker op de site van de club nog zelf moet doen. */
  nogZelfDoen: string[];
};

export function boekingsBestemming(club: Club, datum: string, tijd: string): BoekingsBestemming | null {
  const basis = club.boekingsUrl ?? club.websiteUrl;
  if (!basis) return null;

  if (club.systeem === "Playtomic") {
    const scheiding = basis.includes("?") ? "&" : "?";
    return {
      url: `${basis}${scheiding}date=${datum}`,
      datumInUrl: true,
      tijdInUrl: false,
      nogZelfDoen: [`kies ${tijd} in het rooster`, "kies een baan en speelduur"],
    };
  }

  if (club.systeem === "Foys") {
    return {
      url: basis,
      datumInUrl: false,
      tijdInUrl: false,
      nogZelfDoen: ["klik op 'Boek een baan'", `kies ${datum} en ${tijd}`],
    };
  }

  if (club.systeem === "Meet & Play") {
    return {
      url: basis,
      datumInUrl: false,
      tijdInUrl: false,
      nogZelfDoen:
        club.boekbaarZonderLidmaatschap === true
          // Bevestigd bij Hofgeest (29 juli 2026): geen lidmaatschap nodig,
          // wel een gratis KNLTB ID (alleen e-mailadres) om af te rekenen.
          ? [`zet de datum op ${datum}`, `kies ${tijd}`, "log in met een (gratis) KNLTB ID om af te rekenen"]
          : [`zet de datum op ${datum}`, `kies ${tijd}`, "let op: nog niet geverifieerd of dit zonder lidmaatschap kan"],
    };
  }

  // Baanreserveren en overige: geen enkele keuze is via de URL te zetten.
  return {
    url: basis,
    datumInUrl: false,
    tijdInUrl: false,
    nogZelfDoen: [`zet de datum op ${datum}`, `kies ${tijd}`, "let op: mogelijk alleen voor leden"],
  };
}
