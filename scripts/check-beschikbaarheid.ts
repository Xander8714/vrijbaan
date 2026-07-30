/**
 * Diagnose-commando: wat is er op een dag beschikbaar rond een bepaalde tijd,
 * binnen een straal rond een plaats?
 *
 * Dit is de droge variant van scripts/poll-availability.ts: het haalt dezelfde
 * data bij dezelfde bronnen op, maar schrijft niets naar Supabase en stuurt geen
 * notificatie. Handig om (a) te controleren of alle scrapers nog werken en
 * (b) een concrete vraag te beantwoorden zonder de polling-laag te draaien.
 *
 * Gebruik:
 *   npm run check -- Haarlem 10 2026-07-30 12:00 2
 *                    plaats  km  datum      tijd  marge-in-uren
 */
import { CLUBS } from "../src/lib/clubs";
import { POLL_CONFIG } from "../src/lib/pollConfig";
import { binnenStraal, parseCentroideLl } from "../src/lib/geo";
import { binnenTijdvenster } from "../src/lib/tijd";
import { scrapeMeetAndPlay } from "./scrape-meetandplay";
import { scrapePlaytomic, uniekeStarttijden } from "./scrape-playtomic";
import { fetchFoysAvailability } from "../src/lib/scrapers/foys";

const [plaatsArg, straalArg, datumArg, tijdArg, margeArg] = process.argv.slice(2);
const plaats = plaatsArg ?? "Haarlem";
const straalKm = Number(straalArg ?? "10");
const datum = datumArg ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const tijd = tijdArg ?? "12:00";
const margeUren = Number(margeArg ?? "2");

async function middelpuntVan(plaatsnaam: string): Promise<{ lat: number; lon: number }> {
  const url = new URL("https://api.pdok.nl/bzk/locatieserver/search/v3_1/free");
  url.searchParams.set("q", plaatsnaam);
  url.searchParams.set("fq", "type:woonplaats");
  url.searchParams.set("rows", "1");
  url.searchParams.set("fl", "weergavenaam,centroide_ll");
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = (await res.json()) as { response?: { docs?: { centroide_ll?: string }[] } };
  const punt = parseCentroideLl(data.response?.docs?.[0]?.centroide_ll);
  if (!punt) throw new Error(`Kon geen middelpunt vinden voor "${plaatsnaam}".`);
  return punt;
}

async function slotenVoor(clubId: string): Promise<string[]> {
  const bron = POLL_CONFIG[clubId];
  switch (bron.type) {
    case "meetandplay":
      return (await scrapeMeetAndPlay(bron.meetAndPlayClubId, datum)).slots.map((s) => s.startTime);
    case "playtomic":
      return uniekeStarttijden(await scrapePlaytomic(bron.slug, datum)).map((s) => s.startTime);
    case "foys": {
      const sloten = await fetchFoysAvailability(bron.locationId, datum);
      return [...new Set(sloten.map((s) => s.startTime))].sort();
    }
  }
}

async function main(): Promise<void> {
  const middelpunt = await middelpuntVan(plaats);
  const clubs = binnenStraal(CLUBS, middelpunt, straalKm);

  console.log(`\n${clubs.length} clubs binnen ${straalKm} km van ${plaats}.`);
  console.log(`Gevraagd: ${datum} rond ${tijd} (± ${margeUren} uur)\n`);

  for (const club of clubs) {
    const label = `${club.naam} (${club.plaats}, ${club.afstandKm} km)`;
    if (!(club.id in POLL_CONFIG)) {
      console.log(`  —  ${label}\n     geen koppeling: ${club.systeem} wordt (nog) niet uitgelezen`);
      continue;
    }
    try {
      const alle = await slotenVoor(club.id);
      const passend = alle.filter((t) => binnenTijdvenster(t, tijd, margeUren));
      if (passend.length > 0) {
        console.log(`  ✓  ${label}\n     rond ${tijd}: ${passend.join(", ")}   (${alle.length} vrije tijden die dag)`);
      } else if (alle.length > 0) {
        console.log(`  ·  ${label}\n     niets rond ${tijd}; wel vrij: ${alle.slice(0, 12).join(", ")}${alle.length > 12 ? " …" : ""}`);
      } else {
        console.log(`  ✗  ${label}\n     helemaal niets vrij op ${datum}`);
      }
    } catch (err) {
      console.log(`  !  ${label}\n     ophalen mislukt: ${(err as Error).message}`);
    }
  }
  console.log("");
}

main().catch((err) => {
  console.error("Check mislukt:", err);
  process.exit(1);
});
