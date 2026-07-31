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
 * gebeurt met de service-role key, buiten RLS om) en TELEGRAM_BOT_TOKEN
 * (zonder deze wordt alleen gelogd, zie src/lib/telegram.ts).
 *
 * TELEGRAM-NOTIFICATIES ZIJN PER GEBRUIKER (30 juli 2026, Fase 1) — niet meer
 * één vaste TELEGRAM_CHAT_ID. Elke gebruiker koppelt zijn eigen Telegram via
 * de "Koppel Telegram"-knop op de Account-pagina (deep link + webhook, zie
 * src/app/api/telegram/webhook). Bij een nieuw slot krijgt iedereen die de
 * club volgt (gevolgde_clubs) én Telegram gekoppeld heeft
 * (profiles.telegram_chat_id) één bericht met club + tijd(en) + prijs +
 * boekingslink (zie bouwNotificatieBericht/stuurNotificatiesVoorClub).
 * TELEGRAM_CHAT_ID blijft optioneel bestaan als vaste test-/adminchat die
 * ALTIJD een kopie krijgt, los van wie er gekoppeld is.
 *
 * BEWUSTE SCOPE-KEUZE: dit hergebruikt "een club volgen" (gevolgde_clubs),
 * niet de bredere zoekopdracht (locatie+straal+dag/tijd-voorkeur) uit de
 * oorspronkelijke architectuurschets — dat is een latere fase.
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
import { scrapePlaytomic } from "./scrape-playtomic";
import { fetchFoysAvailability } from "../src/lib/scrapers/foys";
import { CLUBS } from "../src/lib/clubs";
import type { Club } from "../src/lib/types";
import { POLL_CONFIG } from "../src/lib/pollConfig";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { hashSlots, nieuweSlotenSinds, type Slot } from "../src/lib/availabilityDiff";
import { boekingsBestemming } from "../src/lib/boekingsLink";
import { formatEuro } from "../src/lib/geld";
import { stuurTelegramBericht } from "../src/lib/telegram";

// Vandaag + 2 dagen. Bewust LOSSE, kleinere constante van src/lib/tijd.ts se
// DAGEN_VOORUIT (die is 31 juli 2026 naar 7 opgehoogd voor de Radar-weergave)
// — zie de uitgebreide toelichting daar waarom een langer pollvenster hier
// weinig oplevert (vrijgekomen plekken door annulering gebeuren vrijwel
// altijd kort vóór de speeldag) terwijl het wél evenredig meer Playwright-
// runs kost.
const DAGEN_VOORUIT = 3;

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
 * Telegram-chat_id's per club, alleen voor gebruikers die (a) de club volgen
 * én (b) Telegram gekoppeld hebben (profiles.telegram_chat_id). Twee losse,
 * simpele selects + een in-memory join i.p.v. een PostgREST-embed — minder
 * kans op een subtiele foute join-syntax, en beide tabellen zijn klein.
 */
async function haalVolgersPerClub(): Promise<Map<string, number[]>> {
  const supabase = supabaseAdmin();
  const [{ data: gekoppeldeProfielen, error: profielFout }, { data: volgend, error: volgFout }] = await Promise.all([
    supabase.from("profiles").select("id, telegram_chat_id").not("telegram_chat_id", "is", null),
    supabase.from("gevolgde_clubs").select("user_id, club_id"),
  ]);
  if (profielFout || volgFout) {
    console.error(
      "[telegram] Kon volgers per club niet ophalen — notificaties worden deze ronde overgeslagen:",
      (profielFout ?? volgFout)?.message
    );
    return new Map();
  }
  const chatIdPerGebruiker = new Map(
    (gekoppeldeProfielen ?? []).map((p) => [p.id as string, p.telegram_chat_id as number])
  );
  const kaart = new Map<string, number[]>();
  for (const rij of volgend ?? []) {
    const chatId = chatIdPerGebruiker.get(rij.user_id as string);
    if (chatId === undefined) continue;
    const lijst = kaart.get(rij.club_id as string) ?? [];
    lijst.push(chatId);
    kaart.set(rij.club_id as string, lijst);
  }
  return kaart;
}

/** Club + tijd(en) + prijs + boekingslink — zoals afgesproken (30 juli 2026) voor het eerste bericht. */
function bouwNotificatieBericht(club: Club | undefined, clubId: string, datum: string, nieuweSloten: Slot[]): string {
  const naam = club?.naam ?? clubId;
  const gesorteerd = [...nieuweSloten].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const regels = gesorteerd.map((s) => (s.prijs ? `${s.startTime} — ${s.prijs}` : s.startTime)).join("\n");
  const bestemming = club ? boekingsBestemming(club, datum, gesorteerd[0].startTime) : null;
  const linkRegel = bestemming ? `\n\n${bestemming.url}` : "";
  return `${naam} — nieuwe padel-plek(ken) op ${datum}:\n${regels}${linkRegel}`;
}

/**
 * Stuurt één bericht (per club/dag, met alle nieuwe sloten gebundeld — geen
 * los bericht per slot) naar elke gekoppelde volger, plus optioneel naar
 * TELEGRAM_CHAT_ID als vaste test-/adminchat.
 */
async function stuurNotificatiesVoorClub(
  club: Club | undefined,
  clubId: string,
  datum: string,
  nieuweSloten: Slot[],
  volgersPerClub: Map<string, number[]>
): Promise<void> {
  const chatIds = new Set(volgersPerClub.get(clubId) ?? []);
  const adminChat = Number(process.env.TELEGRAM_CHAT_ID);
  if (process.env.TELEGRAM_CHAT_ID && Number.isFinite(adminChat)) chatIds.add(adminChat);
  if (chatIds.size === 0) return;

  const bericht = bouwNotificatieBericht(club, clubId, datum, nieuweSloten);
  for (const chatId of chatIds) {
    await stuurTelegramBericht(chatId, bericht);
  }
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

async function haalSlotenOp(clubId: string, datum: string): Promise<Slot[]> {
  const bron = POLL_CONFIG[clubId];
  switch (bron.type) {
    case "meetandplay":
      // Nog geen prijs beschikbaar voor Meet & Play, zie src/app/api/beschikbaarheid/route.ts.
      return (await scrapeMeetAndPlay(bron.meetAndPlayClubId, datum)).slots.map((s) => ({
        startTime: s.startTime,
        prijs: null,
      }));
    case "playtomic": {
      // Niet uniekeStarttijden() gebruiken: die gooit de prijs weg. Zelfde
      // dedup-per-starttijd, maar met de prijs van de eerste optie die er een heeft.
      const resultaat = await scrapePlaytomic(bron.slug, datum);
      const prijsPerTijd = new Map<string, string | null>();
      for (const s of resultaat.slots) {
        if (!prijsPerTijd.has(s.startTime) || (!prijsPerTijd.get(s.startTime) && s.prijs)) {
          prijsPerTijd.set(s.startTime, s.prijs);
        }
      }
      return [...prijsPerTijd.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([startTime, prijs]) => ({ startTime, prijs }));
    }
    case "foys": {
      // Meerdere speelduren delen dezelfde starttijd; net als de radar tonen
      // we de 60-minuten-prijs als die er is, anders de goedkoopste optie.
      const alleOpties = await fetchFoysAvailability(bron.locationId, datum);
      const perTijd = new Map<string, typeof alleOpties>();
      for (const optie of alleOpties) {
        const lijst = perTijd.get(optie.startTime) ?? [];
        lijst.push(optie);
        perTijd.set(optie.startTime, lijst);
      }
      return [...perTijd.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([startTime, opties]) => {
          const gekozen = opties.find((o) => o.duurMinuten === 60) ?? opties.reduce((a, b) => (a.prijs <= b.prijs ? a : b));
          return { startTime, prijs: formatEuro(gekozen.prijs) };
        });
    }
  }
}

async function pollEenClubEnDag(clubId: string, datum: string, volgersPerClub: Map<string, number[]>): Promise<void> {
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
    await stuurNotificatiesVoorClub(club, clubId, datum, nieuweSloten, volgersPerClub);
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

  const volgersPerClub = await haalVolgersPerClub();
  const totaalVolgers = new Set([...volgersPerClub.values()].flat()).size;
  console.log(`[telegram] ${totaalVolgers} gebruiker(s) met Telegram gekoppeld, verspreid over ${volgersPerClub.size} club(s).`);

  for (const clubId of teVerwerken) {
    for (const datum of dagen) {
      await pollEenClubEnDag(clubId, datum, volgersPerClub);
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
