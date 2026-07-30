/**
 * Genereert src/lib/clubs.foys.ts uit de live Foys-API: alle Peakz-vestigingen
 * in Nederland, met hun echte coördinaten uit de API zelf (dus
 * coordinaatBron "adres", niet het grove woonplaats-middelpunt).
 *
 * Waarom een generator en geen live call in de app: de vestigingenlijst
 * verandert zelden (een nieuwe club per kwartaal), dus een gegenereerd bestand
 * is sneller, werkt offline en is te reviewen in git. Draai dit opnieuw als
 * Peakz een vestiging opent of sluit.
 *
 * Gebruik: npm run import:foys
 */
import { writeFileSync } from "fs";
import { fetchFoysLocaties } from "../src/lib/scrapers/foys";

function slug(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Peakz heeft per vestiging een eigen pagina: /locaties/<stad>/<vestiging>.
 * Geverifieerd op 29 juli 2026 door de links van peakzpadel.nl/locaties uit te
 * lezen — bv. "Haarlem - Haarlemmerstroom" → /locaties/haarlem/haarlemmerstroom.
 * Zo landt "Boek hier" op de juiste vestiging in plaats van op het algemene
 * reserveringsscherm met "KIES EEN STAD" (deep-linken via een query-parameter
 * werkt niet; ?locationId=/?location=/?locatie= geven allemaal weer de
 * stadskiezer).
 */
function vestigingUrl(displayName: string, stad: string): string {
  const delen = displayName.split(" - ");
  const vestiging = delen.length > 1 ? delen.slice(1).join(" - ") : displayName;
  return `https://www.peakzpadel.nl/locaties/${slug(stad)}/${slug(vestiging)}`;
}

// Stad én vestiging in het id: alleen de vestigingsnaam zou kunnen botsen
// zodra twee steden dezelfde straatnaam hebben.
function naarClubId(displayName: string, stad: string): string {
  const delen = displayName.split(" - ");
  const vestiging = delen.length > 1 ? delen.slice(1).join(" - ") : displayName;
  return `peakz-${slug(stad)}-${slug(vestiging)}`;
}

async function main(): Promise<void> {
  const locaties = await fetchFoysLocaties();
  if (locaties.length === 0) {
    throw new Error("Foys gaf 0 vestigingen terug — niets weggeschreven.");
  }

  const vandaag = new Date().toISOString().slice(0, 10);
  const regels = locaties
    .slice()
    .sort((a, b) => a.stad.localeCompare(b.stad, "nl"))
    .map((l) => {
      const id = naarClubId(l.naam, l.stad);
      const adres = [l.adres, l.postcode, l.stad].filter(Boolean).join(", ");
      return (
        // De naam bevat de vestiging, niet alleen de stad: vier keer "Peakz
        // Padel Amsterdam" in de lijst is voor de gebruiker onbruikbaar.
        `  { id: ${JSON.stringify(id)}, naam: ${JSON.stringify(`Peakz Padel ${l.naam}`)}, ` +
        `plaats: ${JSON.stringify(l.stad)}, banen: ${l.banen}, systeem: "Foys", ` +
        `status: ${JSON.stringify(`Actief - Foys locationId ${l.id}`)}, ` +
        `boekingsUrl: ${JSON.stringify(vestigingUrl(l.naam, l.stad))}, ` +
        `adres: ${JSON.stringify(adres)}, lat: ${l.lat}, lon: ${l.lon}, coordinaatBron: "adres", ` +
        // Peakz is commercieel: boeken kan zonder lidmaatschap. Bevestigd
        // doordat de hele reserveringsflow (incl. beschikbaarheid en prijzen)
        // zonder inloggen bereikbaar is.
        `boekbaarZonderLidmaatschap: true, ` +
        `foysLocationId: ${JSON.stringify(l.id)} },`
      );
    });

  const inhoud = `// AUTOMATISCH GEGENEREERD — niet met de hand aanpassen.
// Bron: Foys API /court-booking/public/api/v1/locations (zie src/lib/scrapers/foys.ts).
// Opnieuw genereren met: npm run import:foys
// Laatst gegenereerd: ${vandaag} — ${locaties.length} Peakz-vestigingen.
//
// Coördinaten komen uit de API zelf en horen bij het clubadres, dus
// coordinaatBron is hier "adres" (nauwkeuriger dan de handmatige Haarlemse
// clubs, die nog op het woonplaats-middelpunt staan).
import { Club } from "./types";

export type FoysClub = Club & { foysLocationId: string };

export const FOYS_CLUBS: FoysClub[] = [
${regels.join("\n")}
];
`;

  const pad = "src/lib/clubs.foys.ts";
  writeFileSync(pad, inhoud, "utf8");
  console.log(`${locaties.length} Peakz-vestigingen weggeschreven naar ${pad}:`);
  for (const l of locaties) console.log(`  ${l.stad.padEnd(14)} ${l.naam} (${l.banen} banen)`);
}

main().catch((err) => {
  console.error("Importeren mislukt:", err);
  process.exit(1);
});
