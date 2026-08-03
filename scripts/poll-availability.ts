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
 * src/app/api/telegram/webhook). TELEGRAM_CHAT_ID blijft optioneel bestaan
 * als vaste test-/adminchat die ALTIJD een kopie krijgt, los van wie er
 * gekoppeld is.
 *
 * NOTIFICATIES ALLEEN VOOR GEVOLGDE CLUBS (3 aug 2026-correctie — de eerdere
 * "Fase 2"-uitbreiding hieronder (gebied+voorkeurstijd, ook zonder volgen)
 * is hiermee weer teruggedraaid). Xander: "het slaat nergens op altijd
 * berichtjes te krijgen, alleen bij favorieten en alleen als het past bij
 * je voorkeurstijd." Een "nieuw slot"-melding gaat dus alleen naar wie de
 * club expliciet volgt (gevolgde_clubs, Radar-knop "Volg deze club"), én
 * alleen als het nieuwe slot binnen MARGE_UREN_MELDING van zijn
 * voorkeurstijd valt (geen voorkeurstijd ingesteld = geen tijdsfilter, elk
 * nieuw slot bij een gevolgde club telt dan gewoon). Gebied/straal bepaalt
 * hier niets meer — dat leverde ongevraagde meldingen op voor clubs die
 * iemand nooit gevolgd had. Zie haalOntvangersPerClub/
 * stuurNotificatiesVoorClub. De te pollen clubselectie hieronder blijft dus
 * gewoon "gevolgd + rotatiebatch", geen aparte gebied-uitbreiding.
 *
 * WEKELIJKSE HERINNERING (3 aug 2026, uitgebreid tot meerdere momenten per
 * gebruiker): los van de "nieuw slot"-meldingen hierboven — elk vast
 * speelmoment (Account-pagina, tabel vaste_speelmomenten, meerdere per
 * gebruiker mogelijk, elk met een eigen "op de hoogte houden"-vinkje) levert
 * op die dag, geruime tijd na de sessie, een apart berichtje of datzelfde
 * moment volgende week ook vrij is, met een link naar de Radar. Zie
 * stuurWekelijkseHerinneringen/verwerkWeekherinnering hieronder.
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
import { binnenStraal } from "../src/lib/geo";
import { binnenTijdvenster, naarMinuten } from "../src/lib/tijd";
import { stuurTelegramBericht } from "../src/lib/telegram";
import { bouwSessieLink, maakInlogToken } from "../src/lib/telegramSessie";

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

// Marge rond een voorkeurstijd waarbinnen een nieuw slot nog "meldenswaardig"
// is — zelfde default als de Radar/Account/bot (±2 uur, zie tijd.ts/bot).
const MARGE_UREN_MELDING = 2;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vrijbaan.vercel.app";

/** Eén reden om een melding te krijgen. voorkeurstijd: null = geen tijdsfilter (altijd melden). */
type Ontvanger = { chatId: number; voorkeurstijd: string | null };

/**
 * Ontvangers per club: alleen wie de club expliciet volgt (gevolgde_clubs,
 * Radar-knop "Volg deze club") — zie de moduledocstring voor de 3 aug
 * 2026-correctie die de gebied-gebaseerde uitbreiding weer heeft
 * teruggedraaid. voorkeurstijd komt gewoon uit het profiel van de volger
 * (null = geen tijdsfilter, elk nieuw slot bij deze club telt dan) en wordt
 * pas toegepast in stuurNotificatiesVoorClub.
 */
async function haalOntvangersPerClub(): Promise<Map<string, Ontvanger[]>> {
  const supabase = supabaseAdmin();
  const [{ data: gekoppeldeProfielen, error: profielFout }, { data: volgend, error: volgFout }] = await Promise.all([
    supabase.from("profiles").select("id, telegram_chat_id, voorkeurstijd").not("telegram_chat_id", "is", null),
    supabase.from("gevolgde_clubs").select("user_id, club_id"),
  ]);
  if (profielFout || volgFout) {
    console.error(
      "[telegram] Kon ontvangers per club niet ophalen — notificaties worden deze ronde overgeslagen:",
      (profielFout ?? volgFout)?.message
    );
    return new Map();
  }

  const kaart = new Map<string, Ontvanger[]>();
  const profielPerGebruiker = new Map((gekoppeldeProfielen ?? []).map((p) => [p.id as string, p]));
  for (const rij of volgend ?? []) {
    const profiel = profielPerGebruiker.get(rij.user_id as string);
    if (!profiel) continue;
    const lijst = kaart.get(rij.club_id as string) ?? [];
    lijst.push({
      chatId: profiel.telegram_chat_id as number,
      voorkeurstijd: (profiel.voorkeurstijd as string | null) ?? null,
    });
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
 * los bericht per slot) naar elke ontvanger die dit slot verdient, plus
 * optioneel naar TELEGRAM_CHAT_ID als vaste test-/adminchat.
 *
 * Alle ontvangers hier volgen deze club al expliciet (zie
 * haalOntvangersPerClub) — wat nog filtert is de voorkeurstijd: geen
 * voorkeurstijd ingesteld (null) = altijd melden, anders alleen als
 * minstens één nieuw slot binnen MARGE_UREN_MELDING van die voorkeurstijd valt.
 */
async function stuurNotificatiesVoorClub(
  club: Club | undefined,
  clubId: string,
  datum: string,
  nieuweSloten: Slot[],
  ontvangersPerClub: Map<string, Ontvanger[]>
): Promise<void> {
  const chatIds = new Set<number>();
  for (const ontvanger of ontvangersPerClub.get(clubId) ?? []) {
    const verdient =
      !ontvanger.voorkeurstijd ||
      nieuweSloten.some((s) => binnenTijdvenster(s.startTime, ontvanger.voorkeurstijd!, MARGE_UREN_MELDING));
    if (verdient) chatIds.add(ontvanger.chatId);
  }
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

// --- Wekelijkse herinnering voor een vast speelmoment ------------------
//
// Xander (3 aug 2026): sommige spelers spelen altijd dezelfde dag/tijd (bv.
// elke dinsdag 20:00) — en soms meerdere vaste momenten. Ruim na zo'n sessie
// willen ze weten of datzelfde moment volgende week ook vrij is — een
// pop-up-achtig berichtje, niet de gewone "nieuw slot"-notificatie (die
// reageert op vrijgekomen plekken, niet op een vaste dag/tijd van de
// gebruiker). Ingesteld via tabel vaste_speelmomenten (Account-pagina,
// meerdere rijen per gebruiker mogelijk).
//
// VERTRAGING/VENSTER: 90 min na de speeltijd (Xander noemde zowel "een uur"
// als "21:30 bij een sessie om 20:00" — 21:30 is 90 min, dat is aangehouden)
// met een venster van 30 min erna, zodat een gemiste of vertraagde
// pollronde (elke ~5-10 min extern gepland) het moment niet laat glippen.
// laatste_herinnering_op (per moment, niet per profiel — zie hieronder)
// voorkomt dubbel versturen binnen dezelfde dag.
//
// TIJDZONE: net als de rest van dit script (zie src/lib/tijd.ts,
// komendeDagen) gaat dit uit van de lokale tijd van de machine waar het
// script draait. De VPS zelf staat in UTC (`timedatectl` bevestigt
// "Etc/UTC") — dit was tot 3 aug 2026 dan ook daadwerkelijk stuk: de
// eerder hier genoemde kanttekening bleek geen theoretisch risico maar de
// oorzaak van een gemeld bug (Xander: "het systeem haalt oude tijden op").
// Gefixt met `Environment=TZ=Europe/Amsterdam` in zowel
// vrijebaan-poll.service als vrijebaan.service (niet hier in code, want dit
// geldt voor élke Date-berekening in het hele proces, ook /api/
// beschikbaarheid's alleenToekomstig-filter).
const WEEKHERINNERING_VERTRAGING_MIN = 90;
const WEEKHERINNERING_VENSTER_MIN = 30;
const WEEKHERINNERING_MARGE_UREN = 1;

// Eén rij uit vaste_speelmomenten, samengevoegd met de profielvelden die
// nodig zijn om te melden en te scrapen. Xander (3 aug 2026): "zorg dat ik
// meer vaste momenten kan kiezen" — dus per PROFIEL kunnen hier meerdere
// rijen bestaan (elk met een eigen dag/tijd/gemeld-vinkje en eigen
// laatste_herinnering_op), niet meer hooguit één zoals de vorige
// profiles.terugkerende_dag-kolom toeliet.
type VastMomentMetProfiel = {
  id: string;
  profielId: string;
  dag: number;
  tijd: string;
  chatId: number;
  lat: number;
  lon: number;
  straalKm: number;
};

/** Alle momenten met gemeld=true, gekoppeld profiel met Telegram+locatie, die vandaag nog geen herinnering kregen. */
async function haalWeekherinneringMomenten(nu: Date): Promise<VastMomentMetProfiel[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("vaste_speelmomenten")
    .select("id, profile_id, dag, tijd, laatste_herinnering_op, profiles(telegram_chat_id, lat, lon, zoekstraal_km)")
    .eq("gemeld", true);
  if (error) {
    console.error("[weekherinnering] Kon vaste speelmomenten niet ophalen:", error.message);
    return [];
  }
  const vandaag = toISODate(nu);
  const resultaat: VastMomentMetProfiel[] = [];
  for (const rij of data ?? []) {
    // Bewust in JS gefilterd i.p.v. .neq() in de query: bij een lege
    // laatste_herinnering_op (nog nooit verstuurd) zou .neq() de rij door
    // SQL's drieledige NULL-logica juist stilzwijgend UITsluiten.
    if (rij.laatste_herinnering_op === vandaag) continue;
    // Zonder gegenereerde Supabase-types leidt de client het type van een
    // embedded relatie soms als array af, ook al is dit in werkelijkheid
    // altijd precies één profiel (profile_id verwijst naar precies één
    // rij) — vandaar de omweg via `unknown` en de array-normalisatie.
    const ruwProfiel = rij.profiles as unknown as
      | { telegram_chat_id: number | null; lat: number | null; lon: number | null; zoekstraal_km: number | null }
      | { telegram_chat_id: number | null; lat: number | null; lon: number | null; zoekstraal_km: number | null }[]
      | null;
    const profiel = Array.isArray(ruwProfiel) ? ruwProfiel[0] ?? null : ruwProfiel;
    if (!profiel?.telegram_chat_id || profiel.lat == null || profiel.lon == null) continue;
    resultaat.push({
      id: rij.id as string,
      profielId: rij.profile_id as string,
      dag: rij.dag as number,
      tijd: rij.tijd as string,
      chatId: profiel.telegram_chat_id,
      lat: profiel.lat,
      lon: profiel.lon,
      straalKm: profiel.zoekstraal_km ?? 10,
    });
  }
  return resultaat;
}

async function verwerkWeekherinnering(moment: VastMomentMetProfiel, nu: Date): Promise<void> {
  if (nu.getDay() !== moment.dag) return;
  const voorkeurMin = naarMinuten(moment.tijd);
  if (voorkeurMin === null) return;
  const minutenSindsVoorkeur = nu.getHours() * 60 + nu.getMinutes() - voorkeurMin;
  if (
    minutenSindsVoorkeur < WEEKHERINNERING_VERTRAGING_MIN ||
    minutenSindsVoorkeur >= WEEKHERINNERING_VERTRAGING_MIN + WEEKHERINNERING_VENSTER_MIN
  ) {
    return;
  }

  const supabase = supabaseAdmin();
  const volgendeWeek = new Date(nu);
  volgendeWeek.setDate(volgendeWeek.getDate() + 7);
  const datum = toISODate(volgendeWeek);

  const clubsInBuurt = binnenStraal(
    CLUBS.filter((c) => c.id in POLL_CONFIG),
    { lat: moment.lat, lon: moment.lon },
    moment.straalKm
  );

  const regels: string[] = [];
  for (const club of clubsInBuurt) {
    let sloten: Slot[];
    try {
      sloten = await haalSlotenOp(club.id, datum);
    } catch (err) {
      console.error(`[weekherinnering] ${club.id} ${datum} scrapen mislukt:`, (err as Error).message);
      continue;
    }
    await pauzeerVoorPlaytomic(club.id);
    const passend = sloten.filter((s) => binnenTijdvenster(s.startTime, moment.tijd, WEEKHERINNERING_MARGE_UREN));
    if (passend.length === 0) continue;
    const tijden = passend.map((s) => (s.prijs ? `${s.startTime} (${s.prijs})` : s.startTime)).join(", ");
    regels.push(`• ${club.naam} — ${tijden}`);
  }

  const linkParams = new URLSearchParams({
    lat: String(moment.lat),
    lon: String(moment.lon),
    straal: String(moment.straalKm),
    datum,
    tijd: moment.tijd,
  });
  const radarPad = `/radar?${linkParams.toString()}`;
  let link = `${SITE_URL}${radarPad}`;
  try {
    const token = await maakInlogToken(supabase, moment.profielId);
    link = bouwSessieLink(SITE_URL, token, radarPad);
  } catch (err) {
    console.error("[weekherinnering] Inlogtoken maken mislukt, val terug op kale link:", err);
  }

  const kop = `Je vaste padel-moment: volgende week rond ${moment.tijd} (${datum}).`;
  const bericht =
    regels.length > 0
      ? `${kop}\n\n${regels.join("\n")}\n\nBoek via de Radar:\n${link}`
      : `${kop}\n\nNog niks vrij op dat moment binnen je straal. Kom er iets vrij, dan krijg je daarvoor sowieso een aparte melding.\n\n${link}`;

  await stuurTelegramBericht(moment.chatId, bericht);

  const { error: updateFout } = await supabase
    .from("vaste_speelmomenten")
    .update({ laatste_herinnering_op: toISODate(nu) })
    .eq("id", moment.id);
  if (updateFout) {
    console.error(`[weekherinnering] Kon laatste_herinnering_op niet bijwerken voor moment ${moment.id}:`, updateFout.message);
  }
}

async function stuurWekelijkseHerinneringen(): Promise<void> {
  const nu = new Date();
  const momenten = await haalWeekherinneringMomenten(nu);
  for (const moment of momenten) {
    await verwerkWeekherinnering(moment, nu);
  }
}

async function pollEenClubEnDag(clubId: string, datum: string, ontvangersPerClub: Map<string, Ontvanger[]>): Promise<void> {
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
    await stuurNotificatiesVoorClub(club, clubId, datum, nieuweSloten, ontvangersPerClub);
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

  const ontvangersPerClub = await haalOntvangersPerClub();

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
      `[selectie] ${gevolgd.size} gevolgd (${gevolgdPollbaar.length} pollbaar) + ${rotatie.length} uit de rotatiebatch ` +
        `(van ${nietGevolgdPollbaar.length} overige pollbare clubs) = ${teVerwerken.length} totaal, × ${dagen.length} dagen.`
    );
  }

  const totaalOntvangers = new Set([...ontvangersPerClub.values()].flat().map((o) => o.chatId)).size;
  console.log(
    `[telegram] ${totaalOntvangers} gebruiker(s) met Telegram gekoppeld die minstens één club volgen, ` +
      `verspreid over ${ontvangersPerClub.size} club(s).`
  );

  for (const clubId of teVerwerken) {
    for (const datum of dagen) {
      await pollEenClubEnDag(clubId, datum, ontvangersPerClub);
      await pauzeerVoorPlaytomic(clubId);
    }
  }

  await stuurWekelijkseHerinneringen();
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
