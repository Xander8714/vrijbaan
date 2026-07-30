/**
 * Losse polling-job (géén Next.js request/response cyclus — zie
 * PROJECTPLAN.md §5). Bedoeld om periodiek (5-10 min) te draaien via een
 * externe scheduler: Vercel Cron, een Railway/Render cron-service, of lokaal
 * via Windows Task Scheduler. Dit script zelf doet één ronde en stopt —
 * de herhaling is de verantwoordelijkheid van de scheduler.
 *
 * ⚠️ SELECTIEF SINDS 29 juli 2026 — niet meer "alle clubs in POLL_CONFIG".
 * Met 111+ clubs (Playtomic/Meet & Play kosten elk een eigen Playwright-run
 * van ~15-20s) duurde een volledige ronde ruim een uur — onbruikbaar voor een
 * cyclus van 5-10 min (zie PROJECTPLAN.md §0/§8). Deze job pollt nu:
 * 1. ALTIJD alle clubs die minstens één gebruiker volgt (tabel
 *    `gevolgde_clubs`) — dat is waar een notificatie ook daadwerkelijk voor
 *    iemand betekenis heeft.
 * 2. DAARNAAST een kleine, tijdgebaseerd roterende batch van niet-gevolgde
 *    clubs (zie `kiesRotatieBatch`) — zodat (a) een scraper die kapot gaat
 *    wordt opgemerkt vóórdat iemand de club volgt, en (b) een net-gevolgde
 *    club niet als eerste meting hoeft te wachten op een run die toevallig
 *    NA het volgen komt.
 * Geen aparte cursor-tabel nodig: het rotatieblok wordt afgeleid uit de
 * huidige tijd (`Date.now()`), dus elke run — ongeacht welk proces hem start
 * — schuift automatisch door naar het volgende blok.
 *
 * Per te pollen club:
 * 1. Haal actuele sloten op. Zowel Meet & Play als Playtomic gaan via
 *    Playwright: de eerste omdat de site op Laravel Livewire draait, de tweede
 *    omdat de oude JSON-endpoint dood is en de data nu server-side gerenderd
 *    in de clubpagina staat (zie de respectievelijke scraper-modules).
 * 2. Vergelijk met de laatst opgeslagen stand in Supabase (club_beschikbaarheid).
 * 3. Bij een nieuw slot (niet bij de allereerste meting — zie
 *    availabilityDiff.ts): stuur een Telegram-notificatie.
 * 4. Sla de nieuwe stand op (dit is tegelijk de databron voor de Radar-pagina).
 *
 * Vereist: SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL (schrijven
 * gebeurt met de service-role key, buiten RLS om) en optioneel
 * TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (zonder deze wordt alleen gelogd).
 * ⚠️ Telegram is NIET end-to-end getest in deze sessie (bewuste keuze —
 * eerst de filtering werkend krijgen, Telegram-verificatie volgt vóór
 * uitrol). Zonder de env-vars faalt niets: er wordt dan alleen gelogd.
 *
 * Gebruik:
 *   npx tsx scripts/poll-availability.ts              (gevolgd + rotatiebatch)
 *   npx tsx scripts/poll-availability.ts --alles       (negeer selectie, alles pollen — traag, alleen voor test)
 */

// Dit script draait los van Next.js (via `npx tsx`), dus .env.local wordt NIET
// automatisch geladen zoals Next dat zelf doet — vastgesteld 29 juli 2026 toen
// dit script "supabaseUrl is required" gaf terwijl .env.local wél de juiste
// waarde had. process.loadEnvFile is een Node-ingebouwde API (stabiel sinds
// Node 20.12/21.7, dit project draait op Node 24) — geen extra dependency
// (dotenv) nodig. Ontbreekt het bestand (bv. in productie, waar het platform
// de env-vars al zelf zet), dan negeren we de fout gewoon.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Geen .env.local aanwezig — verwacht in productie, geen probleem.
}

import { scrapeMeetAndPlay } from "./scrape-meetandplay";
import { scrapePlaytomic, uniekeStarttijden } from "./scrape-playtomic";
import { fetchFoysAvailability } from "../src/lib/scrapers/foys";
import { CLUBS } from "../src/lib/clubs";
import { POLL_CONFIG } from "../src/lib/pollConfig";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { hashSlots, nieuweSlotenSinds, type Slot } from "../src/lib/availabilityDiff";

const DAGEN_VOORUIT = 3; // vandaag + 2 dagen — genoeg voor een zinvolle radar zonder overbodig te pollen

// Hoeveel niet-gevolgde clubs per ronde extra meegenomen worden, naast alle
// gevolgde clubs. Bij ~15-20s per Playtomic/Meet & Play-club houdt dit een
// ronde binnen een paar minuten, ook als er nog niemand iets volgt.
const ROTATIE_GROOTTE = 8;
// Hoe lang één rotatieblok "actief" is vóór de volgende batch aan de beurt
// is. Moet ruwweg gelijk zijn aan de cron-cyclus zodat elke ronde een nieuw
// blok pakt in plaats van tweemaal hetzelfde.
const ROTATIE_BLOK_MINUTEN = 5;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function wacht(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pauze tussen Playtomic-aanvragen — een directe, evenredige reactie op de
 * 403 die op 29 juli 2026 optrad na snel herhaald pollen (twee losse runs
 * binnen enkele minuten). Later diezelfde dag bevestigd dat de block
 * TIJDELIJK was (de eerder geblokkeerde club werkte na verloop van tijd
 * gewoon weer) — dus een nette pauze is de juiste, verhoudingsgewijze
 * oplossing, niet iets ingrijpenders (geen user-agent-rotatie, geen
 * IP-omzeiling). Alleen voor Playtomic: Foys en Meet & Play hebben geen
 * enkele aanwijzing van een probleem, dus die onnodig vertragen heeft geen
 * zin. Random binnen een bandbreedte, geen vast interval — een menselijker
 * patroon dan exact om de N seconden.
 */
async function pauzeerVoorPlaytomic(clubId: string): Promise<void> {
  if (POLL_CONFIG[clubId]?.type !== "playtomic") return;
  await wacht(2000 + Math.random() * 2000);
}

/** Alle club_id's die minstens één gebruiker volgt (ongeacht of ze pollbaar zijn — dat filtert de caller). */
async function haalGevolgdeClubIds(): Promise<Set<string>> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("gevolgde_clubs").select("club_id");
  if (error) {
    throw new Error(`Kon gevolgde_clubs niet lezen: ${error.message}`);
  }
  return new Set((data ?? []).map((r) => r.club_id as string));
}

/**
 * Kiest een tijdgebaseerd roterend blok uit de niet-gevolgde, wél pollbare
 * clubs. Geen persistente cursor: het blok volgt puur uit de huidige tijd,
 * dus opeenvolgende runs (elke ~5-10 min, extern gepland) schuiven vanzelf
 * door tot elke club aan de beurt is geweest.
 */
export function kiesRotatieBatch(nietGevolgdPollbaar: string[], nu: Date = new Date()): string[] {
  if (nietGevolgdPollbaar.length === 0) return [];
  // Stabiele volgorde nodig, anders verschuift het blok willekeurig tussen runs.
  const gesorteerd = [...nietGevolgdPollbaar].sort();
  const totaalBlokken = Math.ceil(gesorteerd.length / ROTATIE_GROOTTE);
  const blokIndex = Math.floor(nu.getTime() / (ROTATIE_BLOK_MINUTEN * 60 * 1000)) % totaalBlokken;
  const start = blokIndex * ROTATIE_GROOTTE;
  return gesorteerd.slice(start, start + ROTATIE_GROOTTE);
}

async function stuurTelegramBericht(tekst: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID niet gezet — alleen loggen:", tekst);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: tekst }),
  });
  if (!res.ok) {
    console.error("[telegram] Notificatie mislukt:", res.status, await res.text());
  }
}

async function haalSlotenOp(clubId: string, datum: string): Promise<Slot[]> {
  const bron = POLL_CONFIG[clubId];
  switch (bron.type) {
    case "meetandplay":
      return (await scrapeMeetAndPlay(bron.meetAndPlayClubId, datum)).slots;
    case "playtomic":
      return uniekeStarttijden(await scrapePlaytomic(bron.slug, datum));
    case "foys": {
      const sloten = await fetchFoysAvailability(bron.locationId, datum);
      // Meerdere speelduren delen dezelfde starttijd; voor de radar telt de
      // starttijd, dus dubbelen eruit.
      return [...new Set(sloten.map((s) => s.startTime))].sort().map((startTime) => ({ startTime }));
    }
  }
}

async function pollEenClubEnDag(clubId: string, datum: string): Promise<void> {
  const club = CLUBS.find((c) => c.id === clubId);
  const supabase = supabaseAdmin();

  let sloten: Slot[];
  try {
    sloten = await haalSlotenOp(clubId, datum);
  } catch (err) {
    console.error(`[${clubId} ${datum}] scrapen mislukt:`, (err as Error).message);
    return;
  }

  const { data: vorige, error: leesFout } = await supabase
    .from("club_beschikbaarheid")
    .select("slots, slots_hash")
    .eq("club_id", clubId)
    .eq("datum", datum)
    .maybeSingle();

  if (leesFout) {
    console.error(`[${clubId} ${datum}] kon vorige stand niet lezen:`, leesFout.message);
    return;
  }

  const nieuweHash = hashSlots(sloten);
  if (vorige && vorige.slots_hash === nieuweHash) {
    return; // niets veranderd, niets te doen
  }

  const nieuweSloten = nieuweSlotenSinds(vorige ? (vorige.slots as Slot[]) : null, sloten);

  const { error: schrijfFout } = await supabase.from("club_beschikbaarheid").upsert({
    club_id: clubId,
    datum,
    slots: sloten,
    slots_hash: nieuweHash,
    bijgewerkt_op: new Date().toISOString(),
  });
  if (schrijfFout) {
    console.error(`[${clubId} ${datum}] kon nieuwe stand niet opslaan:`, schrijfFout.message);
    return;
  }

  if (nieuweSloten.length > 0) {
    const tijden = nieuweSloten.map((s) => s.startTime).sort().join(", ");
    console.log(`[${clubId} ${datum}] nieuwe sloten: ${tijden}`);
    await stuurTelegramBericht(
      `Nieuwe padel-sloten bij ${club?.naam ?? clubId} op ${datum}: ${tijden}`
    );
  } else {
    console.log(`[${clubId} ${datum}] stand bijgewerkt (geen nieuwe sloten, wel wijziging — bv. iets geboekt).`);
  }
}

async function main(): Promise<void> {
  const vandaag = new Date();
  const dagen = Array.from({ length: DAGEN_VOORUIT }, (_, i) => {
    const d = new Date(vandaag);
    d.setDate(d.getDate() + i);
    return toISODate(d);
  });

  const alleGeforceerd = process.argv.includes("--alles");
  const pollbareIds = Object.keys(POLL_CONFIG);

  let teVerwerken: string[];
  if (alleGeforceerd) {
    teVerwerken = pollbareIds;
    console.log(`[selectie] --alles opgegeven: alle ${teVerwerken.length} pollbare clubs (traag, alleen voor test).`);
  } else {
    const gevolgd = await haalGevolgdeClubIds();
    const gevolgdPollbaar = pollbareIds.filter((id) => gevolgd.has(id));
    const nietGevolgdPollbaar = pollbareIds.filter((id) => !gevolgd.has(id));
    const rotatie = kiesRotatieBatch(nietGevolgdPollbaar, vandaag);
    teVerwerken = [...new Set([...gevolgdPollbaar, ...rotatie])];
    console.log(
      `[selectie] ${gevolgdPollbaar.length} gevolgde clubs + ${rotatie.length} uit de rotatiebatch ` +
        `(van ${nietGevolgdPollbaar.length} niet-gevolgde pollbare clubs) = ${teVerwerken.length} totaal, ` +
        `× ${dagen.length} dagen.`
    );
  }

  for (const clubId of teVerwerken) {
    for (const datum of dagen) {
      await pollEenClubEnDag(clubId, datum);
      await pauzeerVoorPlaytomic(clubId);
    }
  }
}

// Bewust met een module-guard (zelfde patroon als scrape-meetandplay.ts en
// scrape-playtomic.ts): zonder deze guard start main() — met echte Supabase-
// schrijven en echte scrapers — al bij het simpelweg IMPORTEREN van dit
// bestand, wat een unit test die alleen kiesRotatieBatch nodig heeft onbedoeld
// een volledige polling-run zou laten uitvoeren.
if (require.main === module) {
  main().catch((err) => {
    console.error("Polling-run mislukt:", err);
    process.exit(1);
  });
}
