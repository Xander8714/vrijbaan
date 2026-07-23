/**
 * Losse polling-job (géén Next.js request/response cyclus — zie
 * PROJECTPLAN.md §5). Bedoeld om periodiek (5-10 min) te draaien via een
 * externe scheduler: Vercel Cron, een Railway/Render cron-service, of lokaal
 * via Windows Task Scheduler. Dit script zelf doet één ronde en stopt —
 * de herhaling is de verantwoordelijkheid van de scheduler.
 *
 * Per club in POLL_CONFIG (src/lib/pollConfig.ts):
 * 1. Haal actuele sloten op (Meet & Play via Playwright, of Playtomic via
 *    de onofficiële endpoint — zie de respectievelijke scraper-modules).
 * 2. Vergelijk met de laatst opgeslagen stand in Supabase (club_beschikbaarheid).
 * 3. Bij een nieuw slot (niet bij de allereerste meting — zie
 *    availabilityDiff.ts): stuur een Telegram-notificatie.
 * 4. Sla de nieuwe stand op (dit is tegelijk de databron voor de Radar-pagina).
 *
 * Vereist: SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL (schrijven
 * gebeurt met de service-role key, buiten RLS om) en optioneel
 * TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (zonder deze wordt alleen gelogd).
 *
 * Gebruik: npx tsx scripts/poll-availability.ts
 */

import { scrapeMeetAndPlay } from "./scrape-meetandplay";
import { fetchPlaytomicAvailability } from "../src/lib/scrapers/playtomic";
import { fetchFoysAvailability } from "../src/lib/scrapers/foys";
import { CLUBS } from "../src/lib/clubs";
import { POLL_CONFIG } from "../src/lib/pollConfig";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { hashSlots, nieuweSlotenSinds, type Slot } from "../src/lib/availabilityDiff";

const DAGEN_VOORUIT = 3; // vandaag + 2 dagen — genoeg voor een zinvolle radar zonder overbodig te pollen

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
      return (await fetchPlaytomicAvailability(bron.tenantId, datum)).map((s) => ({ startTime: s.startTime }));
    case "foys":
      return (await fetchFoysAvailability(bron.locationId, bron.reservationTypeId, datum)).map((s) => ({
        startTime: s.startTime,
      }));
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

  for (const clubId of Object.keys(POLL_CONFIG)) {
    for (const datum of dagen) {
      await pollEenClubEnDag(clubId, datum);
    }
  }
}

main().catch((err) => {
  console.error("Polling-run mislukt:", err);
  process.exit(1);
});
