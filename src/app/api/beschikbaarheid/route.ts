import { NextRequest, NextResponse } from "next/server";
import { POLL_CONFIG } from "@/lib/pollConfig";
import { fetchFoysAvailability } from "@/lib/scrapers/foys";
import { formatEuro } from "@/lib/geld";

/**
 * Beschikbaarheid op aanvraag: alleen voor de clubs die de gebruiker ná
 * filteren daadwerkelijk ziet.
 *
 * WAAROM ZO, en niet alles pollen: de bronnen verschillen enorm in kosten.
 * Foys levert álle 26 Peakz-vestigingen in één HTTP-call (gecached per datum in
 * src/lib/scrapers/foys.ts). Playtomic en Meet & Play kosten elk een eigen
 * Playwright-run van ~15-20 seconden per club per dag. Met 111 clubs in
 * POLL_CONFIG zou een volledige ronde ruim een uur duren — onbruikbaar. Door
 * alleen de zichtbare selectie op te halen, betaal je alleen voor wat je bekijkt.
 *
 * MAX_CLUBS is daarom een harde grens: boven de 20 clubs geeft deze route een
 * duidelijke fout terug in plaats van een verzoek van minuten te starten. De UI
 * vraagt de gebruiker dan zijn selectie te verkleinen (kleinere straal of een
 * voorkeurstijd).
 *
 * Let op: browser-gebaseerde bronnen (Playtomic, Meet & Play) draaien Playwright
 * en kunnen daarom niet in de Edge-runtime.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const MAX_CLUBS = 20;

// Hoeveel bronnen we tegelijk aanspreken. Elke Playwright-run kost een eigen
// browserproces, dus dit is een afweging tussen snelheid en geheugen.
const GELIJKTIJDIG = 4;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type Slot = { tijd: string; prijs: string | null };

/**
 * Tijden die vandaag al voorbij zijn eruit filteren.
 *
 * Nodig omdat de bronnen dit zelf niet doen: de Foys-API gaf om 23:23 nog
 * gewoon 08:00 t/m 22:00 terug als `isAvailable` (bevestigd 29 juli 2026 in de
 * draaiende app). Dat is voor de gebruiker onzin — je kunt geen baan van
 * vanmorgen meer boeken — en het maakt de radar onbetrouwbaar.
 *
 * Alleen voor vandaag; voor morgen en overmorgen is elke tijd geldig.
 */
function alleenToekomstig(sloten: Slot[], datum: string, nu: Date = new Date()): Slot[] {
  const vandaag = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-${String(nu.getDate()).padStart(2, "0")}`;
  if (datum !== vandaag) return sloten;
  const minutenNu = nu.getHours() * 60 + nu.getMinutes();
  return sloten.filter(({ tijd }) => {
    const [u, m] = tijd.split(":").map(Number);
    if (!Number.isFinite(u) || !Number.isFinite(m)) return false;
    return u * 60 + m > minutenNu;
  });
}

export type ClubBeschikbaarheid = {
  clubId: string;
  sloten: Slot[];
  fout?: string;
};

/**
 * Korte in-memory cache per club+dag — Xander (3 aug 2026): "we hadden daar
 * toch iets voor verzonnen, kort opslaan zodat ze niet nogmaals moeten
 * wachten". Concreet scenario: de Telegram-bot roept deze route al aan voor
 * een losse zoekopdracht (zie zoekBeschikbaarheidVoorChat) en linkt daarna
 * naar de Radar met dezelfde lat/lon/straal/datum — de Radar-pagina doet bij
 * het openen van zo'n link meteen zelf ook een aanvraag voor (grotendeels)
 * dezelfde clubs. Zonder cache scraapt dat twee keer, dus wacht de
 * gebruiker na een al-beantwoorde botvraag alsnog nogmaals tientallen
 * seconden op Playwright.
 *
 * Nu pas veilig als proces-geheugen (na de VPS-migratie draait dit als één
 * langlevende systemd-service, niet meer als kortstondige Vercel-functies
 * die toch geen gedeeld geheugen hadden).
 *
 * TTL bewust kort: lang genoeg voor de bot→Radar-overstap (meestal enkele
 * seconden), kort genoeg om "live" te blijven voor het hele punt van de app
 * — een net vrijgekomen plek door een annulering.
 */
const CACHE_TTL_MS = 90_000;
const cache = new Map<string, { sloten: Slot[]; verlooptOp: number }>();

async function slotenVoorClubMetCache(clubId: string, datum: string): Promise<Slot[]> {
  const sleutel = `${clubId}:${datum}`;
  const bestaand = cache.get(sleutel);
  const nu = Date.now();
  if (bestaand && bestaand.verlooptOp > nu) return bestaand.sloten;
  // Bewust NIET cachen bij een mislukte scrape: een tijdelijke fout mag niet
  // de volle TTL blijven hangen voor iedereen die deze club daarna opvraagt.
  const sloten = await slotenVoorClub(clubId, datum);
  cache.set(sleutel, { sloten, verlooptOp: nu + CACHE_TTL_MS });
  return sloten;
}

async function slotenVoorClub(clubId: string, datum: string): Promise<Slot[]> {
  const bron = POLL_CONFIG[clubId];
  if (!bron) throw new Error("Deze club is niet gekoppeld aan een boekingssysteem.");

  switch (bron.type) {
    case "foys": {
      // Eén starttijd kan meerdere duren (60/90/120 min) met elk een eigen
      // prijs hebben. We tonen er één prijs per tijd — de 60-minuten-prijs als
      // die er is (de gangbare padel-boekingsduur), anders de goedkoopste optie.
      const alleOpties = await fetchFoysAvailability(bron.locationId, datum);
      const perTijd = new Map<string, typeof alleOpties>();
      for (const optie of alleOpties) {
        const lijst = perTijd.get(optie.startTime) ?? [];
        lijst.push(optie);
        perTijd.set(optie.startTime, lijst);
      }
      return [...perTijd.entries()]
        .map(([tijd, opties]) => {
          const gekozen = opties.find((o) => o.duurMinuten === 60) ?? opties.reduce((a, b) => (a.prijs <= b.prijs ? a : b));
          return { tijd, prijs: formatEuro(gekozen.prijs) };
        })
        .sort((a, b) => a.tijd.localeCompare(b.tijd));
    }
    case "playtomic": {
      // Dynamisch importeren: deze modules trekken Playwright mee, en dat hoort
      // niet in de bundel van een verzoek dat alleen Foys nodig heeft.
      const { scrapePlaytomic } = await import("../../../../scripts/scrape-playtomic");
      const resultaat = await scrapePlaytomic(bron.slug, datum);
      const perTijd = new Map<string, typeof resultaat.slots>();
      for (const optie of resultaat.slots) {
        const lijst = perTijd.get(optie.startTime) ?? [];
        lijst.push(optie);
        perTijd.set(optie.startTime, lijst);
      }
      return [...perTijd.entries()]
        .map(([tijd, opties]) => {
          const gekozen = opties.find((o) => o.duurMinuten === 60 && o.prijs) ?? opties.find((o) => o.prijs) ?? opties[0];
          return { tijd, prijs: gekozen.prijs };
        })
        .sort((a, b) => a.tijd.localeCompare(b.tijd));
    }
    case "meetandplay": {
      // Nog geen prijs beschikbaar: de scraper leest alleen input[name="time"]
      // uit, niet de prijs die ernaast in het winkelmandje verschijnt (wél
      // bevestigd aanwezig, zie API_REQUIREMENTS.md §2b) — nog te bouwen.
      const { scrapeMeetAndPlay } = await import("../../../../scripts/scrape-meetandplay");
      const resultaat = await scrapeMeetAndPlay(bron.meetAndPlayClubId, datum);
      const tijden = [...new Set(resultaat.slots.map((s) => s.startTime))].sort();
      return tijden.map((tijd) => ({ tijd, prijs: null }));
    }
  }
}

/** Werkt de lijst in batches af zodat er nooit meer dan GELIJKTIJDIG browsers open staan. */
async function inBatches(clubIds: string[], datum: string): Promise<ClubBeschikbaarheid[]> {
  const uit: ClubBeschikbaarheid[] = [];
  for (let i = 0; i < clubIds.length; i += GELIJKTIJDIG) {
    const batch = clubIds.slice(i, i + GELIJKTIJDIG);
    const resultaten = await Promise.all(
      batch.map(async (clubId): Promise<ClubBeschikbaarheid> => {
        try {
          return { clubId, sloten: alleenToekomstig(await slotenVoorClubMetCache(clubId, datum), datum) };
        } catch (err) {
          // Eén kapotte bron mag de rest niet meesleuren: de club komt terug
          // met een foutmelding in plaats van stil te verdwijnen. De ECHTE
          // foutmelding (bv. een rauwe Playwright-timeout als
          // "page.waitForResponse: Timeout 10000ms exceeded...", gezien bij
          // Groeneveen op 30 juli 2026) gaat naar de server-log, niet naar de
          // gebruiker — die heeft niets aan interne technische details en
          // kan er toch niets mee. Xander: "zeg dan geen tijden geladen,
          // refresh de pagina om opnieuw te proberen".
          console.error(`[beschikbaarheid] ${clubId} (${datum}) mislukt:`, (err as Error).message);
          return { clubId, sloten: [], fout: "Geen tijden geladen. Ververs de pagina om opnieuw te proberen." };
        }
      })
    );
    uit.push(...resultaten);
  }
  return uit;
}

export async function GET(request: NextRequest) {
  const clubsParam = request.nextUrl.searchParams.get("clubs") ?? "";
  const datum = request.nextUrl.searchParams.get("datum") ?? "";

  if (!ISO_DATE_RE.test(datum)) {
    return NextResponse.json({ error: "Geef 'datum' op als YYYY-MM-DD." }, { status: 400 });
  }

  const clubIds = clubsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (clubIds.length === 0) {
    return NextResponse.json({ error: "Geef minstens één club op." }, { status: 400 });
  }
  if (clubIds.length > MAX_CLUBS) {
    return NextResponse.json(
      {
        error:
          `${clubIds.length} clubs is te veel om live op te halen (maximaal ${MAX_CLUBS}). ` +
          "Maak je selectie kleiner met een kleinere straal of een voorkeurstijd.",
        teVeel: true,
        aantal: clubIds.length,
        maximum: MAX_CLUBS,
      },
      { status: 413 }
    );
  }

  // Clubs zonder koppeling er meteen uit: die kosten anders een mislukte poging.
  const gekoppeld = clubIds.filter((id) => id in POLL_CONFIG);
  const ongekoppeld = clubIds.filter((id) => !(id in POLL_CONFIG));

  const resultaten = await inBatches(gekoppeld, datum);

  return NextResponse.json({
    datum,
    beschikbaarheid: [
      ...resultaten,
      ...ongekoppeld.map((clubId) => ({
        clubId,
        sloten: [],
        fout: "Nog niet gekoppeld aan een boekingssysteem.",
      })),
    ],
    opgehaaldOp: new Date().toISOString(),
  });
}
