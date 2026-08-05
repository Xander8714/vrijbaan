import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stuurTelegramBericht } from "@/lib/telegram";
import { haalSocialMediaAdminViaChatId } from "@/lib/socialMedia/admin";
import { archiveerConcept, keurConceptGoed } from "@/lib/socialMedia/repository";
import {
  bevatVerbodenActie,
  bouwLocatieKeyboard,
  extraheerFlexibeleTijd,
  formatteerVastMoment,
  parseAdhocZoekopdracht,
  parseProfielWijzigingen,
  parseVastMomentOpdracht,
  pasVasteMomentToe,
  type ParseResultaat,
  zoekBeschikbaarheidVoorChat,
  zoekLocatieKandidaten,
} from "@/lib/telegramConversatie";
import type { GevondenLocatie } from "@/lib/geo";

/**
 * Ontvangt Telegram-updates voor @vrijbaan_notify_bot (geregistreerd via
 * setWebhook, zie PROJECTPLAN.md). Verwerkt:
 * - `/start <code>`: koppelt de chat aan het profiel (Fase 1, 30 juli 2026),
 *   en start meteen de onboarding-vragen (2 aug 2026).
 * - Onboarding-antwoorden (locatie via inline keyboard, dan tijd) — zie
 *   telegram_onboarding_stap in profiles en src/lib/telegramConversatie.ts.
 * - Losse zoekopdrachten in vrije tekst ("zoek een baan in Haarlem rond
 *   20:00") wanneer er geen actief gesprek loopt.
 * - Profiel aanpassen via vrije tekst buiten onboarding om (5 aug 2026):
 *   straal, tijd, locatie en vaste speelmomenten (dag+tijd), plus /help,
 *   /status, /annuleer en een blokkade van gevoelige accountacties
 *   (telefoonnummer, account verwijderen) — zie telegramConversatie.ts voor
 *   de parsers en waarom "favoriete dagen" op vaste_speelmomenten aansluit
 *   i.p.v. een nieuwe kolom.
 *
 * BEVEILIGING: Telegram stuurt de secret die bij setWebhook is opgegeven mee
 * in de X-Telegram-Bot-Api-Secret-Token header. Zonder die check zou iedereen
 * die deze URL kent een willekeurige chat_id aan een willekeurige koppelcode
 * kunnen plakken.
 *
 * Geeft altijd 200 terug op een geldige Telegram-update — Telegram blijft
 * anders retryen, en de gebruiker krijgt de foutmelding toch al terug als
 * chatbericht.
 */
export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vrijbaan.vercel.app";
// Standaardstraal bij onboarding — zelfde default als de Radar/Account-
// pagina's zoekstraal_km, zodat "waar wil je padellen" hetzelfde betekent
// als het zoekgebied dat je op de website zou instellen.
const STANDAARD_STRAAL_KM = 10;

type TelegramUpdate = {
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number } } };
};

type TelegramStap =
  | "wacht_locatie_onboarding"
  | "wacht_tijd_onboarding"
  | "wacht_locatie_adhoc"
  | "wacht_locatie_profiel"
  | null;

type TelegramKandidaten = { kandidaten: GevondenLocatie[]; tijd?: string | null; dagOffset?: number | null };
type Admin = ReturnType<typeof supabaseAdmin>;

// Volledig profiel zoals de bot het nodig heeft — één select i.p.v. de
// eerdere twee losse (één voor callback_query, één voor tekstberichten) die
// niet dezelfde velden ophaalden, waardoor /status en profielwijzigingen
// eerst een extra query nodig hadden.
type ProfielRij = {
  id: string;
  telegram_onboarding_stap: TelegramStap;
  telegram_kandidaten?: TelegramKandidaten | null;
  woonplaats?: string | null;
  zoekstraal_km?: number | null;
  voorkeurstijd?: string | null;
};

async function haalProfielOp(admin: Admin, chatId: number): Promise<ProfielRij | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, telegram_onboarding_stap, telegram_kandidaten, woonplaats, zoekstraal_km, voorkeurstijd")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (error) {
    console.error("[telegram] Profiel ophalen mislukt:", error.message);
    return null;
  }
  return data as ProfielRij | null;
}

async function stuurLocatieKeuze(chatId: number, tekst: string, kandidaten: GevondenLocatie[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { console.warn("[telegram] TELEGRAM_BOT_TOKEN niet gezet."); return; }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: tekst, reply_markup: bouwLocatieKeyboard(kandidaten) }),
  });
  if (!res.ok) console.error("[telegram] sendMessage met keyboard mislukt:", res.status, await res.text());
}

/**
 * Verwerkt een klik op "✅ Goedkeuren"/"❌ Afwijzen" onder een socialmedia-
 * goedkeuringsverzoek (5 aug 2026, zie lib/socialMedia/telegramGoedkeuring.ts
 * voor de kant die dit bericht verstuurt). Geeft `null` terug als `data`
 * niet bij deze flow hoort, zodat de aanroeper daarna gewoon de bestaande
 * "loc:"-afhandeling kan proberen.
 *
 * Beveiliging: haalSocialMediaAdminViaChatId toetst deze chat_id tegen
 * dezelfde SOCIAL_MEDIA_ADMIN_EMAILS-lijst als de beheerpagina — een
 * willekeurige Telegram-gebruiker die deze callback_data zou weten te raden
 * (36-teken-UUID, praktisch onraadbaar, maar toch) kan hier nooit iets mee
 * zonder een gekoppeld beheerdersaccount.
 */
async function verwerkSocialGoedkeuringCallback(chatId: number, data: string): Promise<string | null> {
  const match = /^(smgoed|smafw):([0-9a-f-]{36})$/i.exec(data);
  if (!match) return null;
  const [, actie, id] = match;

  const admin = await haalSocialMediaAdminViaChatId(chatId);
  if (!admin) return "Deze actie is alleen voor beheerders.";

  try {
    if (actie === "smgoed") {
      await keurConceptGoed(id, admin.id, null);
      return "✅ Goedgekeurd — de worker publiceert 'm zo snel mogelijk.";
    }
    await archiveerConcept(id, admin.id);
    return "❌ Afgewezen en gearchiveerd.";
  } catch (fout) {
    return `Kon dit niet verwerken: ${fout instanceof Error ? fout.message : String(fout)}`;
  }
}

async function beantwoordCallback(callbackQueryId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  // Zonder deze aanroep blijft Telegram's client de knop als "bezig" tonen.
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  }).catch(() => {});
}

/** Zoekt kandidaten voor `plaatsQuery`, bewaart ze tijdelijk, en toont ze als keuzeknoppen. */
async function vraagLocatieKeuze(
  admin: Admin,
  profielId: string,
  chatId: number,
  plaatsQuery: string,
  stap: "wacht_locatie_onboarding" | "wacht_locatie_adhoc" | "wacht_locatie_profiel",
  tijdVoorAdhoc: string | null,
  dagOffsetVoorAdhoc: number | null = null
): Promise<void> {
  let kandidaten: GevondenLocatie[];
  try {
    kandidaten = await zoekLocatieKandidaten(plaatsQuery);
  } catch (err) {
    await stuurTelegramBericht(chatId, `Locatie zoeken lukte niet: ${(err as Error).message}`);
    return;
  }
  if (kandidaten.length === 0) {
    await stuurTelegramBericht(
      chatId,
      `Ik kon "${plaatsQuery}" niet vinden. Probeer een andere schrijfwijze, bijvoorbeeld alleen de plaatsnaam.`
    );
    return;
  }
  const opslag: TelegramKandidaten = { kandidaten, tijd: tijdVoorAdhoc, dagOffset: dagOffsetVoorAdhoc };
  await admin
    .from("profiles")
    .update({ telegram_onboarding_stap: stap, telegram_kandidaten: opslag })
    .eq("id", profielId);
  await stuurLocatieKeuze(chatId, "Bedoel je een van deze?", kandidaten);
}

async function stuurHelp(chatId: number): Promise<void> {
  await stuurTelegramBericht(
    chatId,
    [
      "Dit kan ik voor je doen:",
      "",
      '🔎 Banen zoeken: "zoek morgen een baan in Haarlem rond 2000"',
      '📏 Straal aanpassen: "maak mijn straal 5 km"',
      '🕒 Tijd instellen: "zet mijn tijd op 2000" (mag ook 20:00, 830 of 8)',
      '📍 Locatie wijzigen: "verander mijn locatie naar Leiden"',
      '📅 Vast speelmoment toevoegen: "zet dinsdag 20:00 als vast moment"',
      '➖ Vast speelmoment verwijderen: "haal dinsdag weg"',
      "⚙️ Instellingen bekijken: /status",
      "❌ Actie stoppen: /annuleer",
      "",
      "Tijden mogen met of zonder dubbele punt: 20:00, 2000, 830 of 8.",
      "",
      "Uit veiligheid kan ik geen telefoonnummer wijzigen en geen account verwijderen — dat kan alleen via je Account-pagina.",
    ].join("\n")
  );
}

async function toonProfielstatus(admin: Admin, profiel: ProfielRij, chatId: number): Promise<void> {
  const { data: momenten, error } = await admin
    .from("vaste_speelmomenten")
    .select("dag, tijd, gemeld")
    .eq("profile_id", profiel.id);

  if (error) console.error("[telegram] Vaste speelmomenten voor /status ophalen mislukt:", error.message);

  const momentRegels =
    momenten && momenten.length > 0
      ? momenten
          .map((m) => `  • ${formatteerVastMoment(m.dag as number, m.tijd as string)}${m.gemeld ? "" : " (melding uit)"}`)
          .join("\n")
      : "  geen";

  await stuurTelegramBericht(
    chatId,
    [
      "Je huidige VrijeBaan-voorkeuren:",
      `📍 Locatie: ${profiel.woonplaats ?? "niet ingesteld"}`,
      `📏 Straal: ${profiel.zoekstraal_km ?? STANDAARD_STRAAL_KM} km`,
      `🕒 Tijd: ${profiel.voorkeurstijd ?? "geen voorkeur"}`,
      "📅 Vaste speelmomenten:",
      momentRegels,
      "",
      'Je kunt bijvoorbeeld sturen: "maak straal 5 km en zet mijn tijd op 2000", of "zet dinsdag 20:00 als vast moment".',
    ].join("\n")
  );
}

/**
 * Voert straal/tijd/locatie in één update door — zodat "maak straal 5 km en
 * zet mijn tijd op 2000" in één keer verwerkt wordt i.p.v. de gebruiker twee
 * losse berichten te laten sturen. Locatie loopt appart via vraagLocatieKeuze
 * (die heeft eerst een geocode + keuzeknoppen nodig), dus die wordt door de
 * aanroeper zelf al afgehandeld — dit hier verwerkt alleen straal en tijd.
 */
async function pasProfielWijzigingenToe(
  admin: Admin,
  profiel: ProfielRij,
  chatId: number,
  wijzigingen: ParseResultaat["wijzigingen"]
): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  const bevestigingen: string[] = [];

  if (wijzigingen.straalKm !== undefined) {
    updateData.zoekstraal_km = wijzigingen.straalKm;
    bevestigingen.push(`straal ${wijzigingen.straalKm} km`);
  }

  if (wijzigingen.voorkeurstijd !== undefined) {
    updateData.voorkeurstijd = wijzigingen.voorkeurstijd;
    bevestigingen.push(wijzigingen.voorkeurstijd ? `tijd rond ${wijzigingen.voorkeurstijd}` : "geen vaste tijd");
  }

  if (Object.keys(updateData).length === 0) return false;

  const { error } = await admin.from("profiles").update(updateData).eq("id", profiel.id);

  if (error) {
    console.error("[telegram] Profielwijziging mislukt:", error.message);
    await stuurTelegramBericht(chatId, "De wijziging kon niet worden opgeslagen. Probeer het later opnieuw.");
    return true;
  }

  // Onboarding-tijdvraag beantwoord via een "profiel wijzigen"-achtige zin
  // (bv. "zet mijn tijd op 2000" tijdens wacht_tijd_onboarding) rondt de
  // onboarding ook meteen af — anders zou de bot op de oude vraag blijven
  // wachten terwijl de tijd al is opgeslagen.
  if (profiel.telegram_onboarding_stap === "wacht_tijd_onboarding" && wijzigingen.voorkeurstijd !== undefined) {
    await admin.from("profiles").update({ telegram_onboarding_stap: null }).eq("id", profiel.id);
  }

  await stuurTelegramBericht(chatId, `Aangepast: ${bevestigingen.join(", ")}.`);
  return true;
}

export async function POST(req: NextRequest) {
  const verwachteSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const ontvangenSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!verwachteSecret || ontvangenSecret !== verwachteSecret) {
    return NextResponse.json({ error: "Ongeldige of ontbrekende secret." }, { status: 401 });
  }

  const update = (await req.json()) as TelegramUpdate;
  const admin = supabaseAdmin();

  // --- Inline-keyboard-klik: gebruiker koos een locatiekandidaat ---
  if (update.callback_query) {
    const cq = update.callback_query;
    await beantwoordCallback(cq.id);
    const chatId = cq.message?.chat.id;
    const data = cq.data;

    if (chatId && data && (data.startsWith("smgoed:") || data.startsWith("smafw:"))) {
      const antwoord = await verwerkSocialGoedkeuringCallback(chatId, data);
      if (antwoord) await stuurTelegramBericht(chatId, antwoord);
      return NextResponse.json({ ok: true });
    }

    if (!chatId || !data?.startsWith("loc:")) return NextResponse.json({ ok: true });

    const profiel = await haalProfielOp(admin, chatId);
    if (!profiel) return NextResponse.json({ ok: true });

    const opgeslagen = profiel.telegram_kandidaten as TelegramKandidaten | null;
    const index = Number(data.slice(4));
    const kandidaat = opgeslagen?.kandidaten?.[index];
    if (!kandidaat) {
      await stuurTelegramBericht(chatId, "Deze keuze is verlopen. Stuur je locatie nog een keer.");
      return NextResponse.json({ ok: true });
    }
    const naam = kandidaat.woonplaatsnaam ?? kandidaat.weergavenaam;

    if (profiel.telegram_onboarding_stap === "wacht_locatie_onboarding") {
      await admin
        .from("profiles")
        .update({
          lat: kandidaat.lat,
          lon: kandidaat.lon,
          woonplaats: naam,
          zoekstraal_km: STANDAARD_STRAAL_KM,
          telegram_onboarding_stap: "wacht_tijd_onboarding",
          telegram_kandidaten: null,
        })
        .eq("id", profiel.id);
      await stuurTelegramBericht(
        chatId,
        `Genoteerd: ${naam}, straal ${STANDAARD_STRAAL_KM} km.\n\nHoe laat wil je meestal padellen? Typ een tijd (bv. 19:00), of stuur "geen voorkeur".`
      );
      return NextResponse.json({ ok: true });
    }

    if (profiel.telegram_onboarding_stap === "wacht_locatie_adhoc") {
      await admin.from("profiles").update({ telegram_onboarding_stap: null, telegram_kandidaten: null }).eq("id", profiel.id);
      // Zonder dit bericht lijkt de bot na een klik niets te doen — Xander (3
      // aug 2026): "geef een klik bevestiging terug". zoekBeschikbaarheidVoorChat
      // hieronder kan tientallen seconden duren (Playwright per club), dus de
      // gebruiker moet weten dat de klik is aangekomen vóór het echte antwoord er is.
      await stuurTelegramBericht(chatId, `${naam} gekozen — nu op zoek naar banen…`);
      const antwoord = await zoekBeschikbaarheidVoorChat(
        kandidaat,
        naam,
        opgeslagen?.tijd ?? null,
        SITE_URL,
        opgeslagen?.dagOffset ?? null,
        { admin, profielId: profiel.id }
      );
      await stuurTelegramBericht(chatId, antwoord);
      return NextResponse.json({ ok: true });
    }

    // Locatie wijzigen buiten onboarding om ("verander mijn locatie naar
    // Leiden") — zelfde keuzeknoppen, maar hier alleen lat/lon/woonplaats
    // bijwerken, verder niets aan zoekstraal_km of onboarding-status raken.
    if (profiel.telegram_onboarding_stap === "wacht_locatie_profiel") {
      const { error } = await admin
        .from("profiles")
        .update({
          lat: kandidaat.lat,
          lon: kandidaat.lon,
          woonplaats: naam,
          telegram_onboarding_stap: null,
          telegram_kandidaten: null,
        })
        .eq("id", profiel.id);
      await stuurTelegramBericht(
        chatId,
        error ? "Ik kon je locatie niet aanpassen. Probeer het later opnieuw." : `Aangepast: je locatie is nu ${naam}.`
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  }

  const tekst = update.message?.text?.trim();
  const chatId = update.message?.chat.id;
  if (!tekst || !chatId) return NextResponse.json({ ok: true });

  // --- /start <code>: koppelen, dan meteen de onboarding starten ---
  const startMatch = /^\/start(?:\s+(\S+))?/.exec(tekst);
  if (startMatch) {
    const code = startMatch[1];
    if (!code) {
      await stuurTelegramBericht(
        chatId,
        "Open deze bot via de knop 'Koppel Telegram' op je Account-pagina in VrijeBaan — dan koppel ik automatisch aan je account."
      );
      return NextResponse.json({ ok: true });
    }

    const { data: profiel, error: zoekFout } = await admin
      .from("profiles")
      .select("id")
      .eq("telegram_koppel_code", code)
      .maybeSingle();

    if (zoekFout || !profiel) {
      await stuurTelegramBericht(chatId, "Deze koppelcode ken ik niet (meer). Vraag op je Account-pagina een nieuwe koppellink op.");
      return NextResponse.json({ ok: true });
    }

    // Code is eenmalig: meteen leegmaken zodra hij gebruikt wordt, ongeacht of
    // de update daarna slaagt — een gelekte/oude deep link mag niet nogmaals
    // bruikbaar zijn.
    const { error: updateFout } = await admin
      .from("profiles")
      .update({ telegram_chat_id: chatId, telegram_koppel_code: null, telegram_onboarding_stap: "wacht_locatie_onboarding" })
      .eq("id", profiel.id);

    if (updateFout) {
      const dubbeleChat = /duplicate key|unique/i.test(updateFout.message);
      await stuurTelegramBericht(
        chatId,
        dubbeleChat
          ? "Deze Telegram-chat is al aan een ander VrijeBaan-account gekoppeld."
          : "Koppelen is mislukt. Vraag op je Account-pagina een nieuwe koppellink op."
      );
      return NextResponse.json({ ok: true });
    }

    await stuurTelegramBericht(
      chatId,
      "Gekoppeld! Je krijgt hier voortaan een bericht zodra er een padel-plek vrijkomt.\n\nWaar wil je meestal padellen? Typ een plaatsnaam of postcode."
    );
    return NextResponse.json({ ok: true });
  }

  // --- Actief gesprek? Behandel de tekst als antwoord op de laatste vraag ---
  const profiel = await haalProfielOp(admin, chatId);

  if (!profiel) {
    await stuurTelegramBericht(
      chatId,
      "Ik ken dit gesprek nog niet. Koppel eerst via de knop 'Koppel Telegram' op je Account-pagina in VrijeBaan."
    );
    return NextResponse.json({ ok: true });
  }

  const schoon = tekst.toLowerCase();

  // --- Veilige globale commando's — werken altijd, ook midden in een gesprek ---
  if (/^\/?(help|hulp|mogelijkheden)$/.test(schoon)) {
    await stuurHelp(chatId);
    return NextResponse.json({ ok: true });
  }

  if (
    /^\/?(status|instellingen|voorkeuren)$/.test(schoon) ||
    /\b(wat zijn|toon|laat zien).*\b(instellingen|voorkeuren)\b/.test(schoon) ||
    /\b(wat is|welke).*\b(straal|zoekstraal|vast(e)? (speel)?moment(en)?|tijd)\b/.test(schoon)
  ) {
    await toonProfielstatus(admin, profiel, chatId);
    return NextResponse.json({ ok: true });
  }

  if (/^\/?(annuleer|cancel|stop)$/.test(schoon)) {
    await admin
      .from("profiles")
      .update({ telegram_onboarding_stap: null, telegram_kandidaten: null })
      .eq("id", profiel.id);
    await stuurTelegramBericht(chatId, "De huidige actie is geannuleerd.");
    return NextResponse.json({ ok: true });
  }

  // --- Verboden accountacties altijd vóór verdere interpretatie afvangen ---
  if (bevatVerbodenActie(tekst)) {
    await stuurTelegramBericht(
      chatId,
      "Dit kan ik om veiligheidsredenen niet via Telegram aanpassen. Gebruik hiervoor je Account-pagina in De Vrije Baan."
    );
    return NextResponse.json({ ok: true });
  }

  /**
   * Accountintents komen vóór onboarding-antwoorden en de losse
   * zoekopdracht — zonder deze volgorde zou "maak straal 5 km" tijdens een
   * actief gesprek (bv. de onboarding-tijdvraag) als een ongeldig antwoord
   * op díe vraag worden afgewezen.
   */
  const profielParse = parseProfielWijzigingen(tekst);

  if (profielParse.fout) {
    await stuurTelegramBericht(chatId, profielParse.fout);
    return NextResponse.json({ ok: true });
  }

  if (profielParse.wijzigingen.locatieQuery) {
    await vraagLocatieKeuze(
      admin,
      profiel.id,
      chatId,
      profielParse.wijzigingen.locatieQuery,
      "wacht_locatie_profiel",
      null
    );
    // Straal/tijd kunnen in hetzelfde bericht staan als de locatiewijziging
    // ("maak straal 5 km en verander mijn locatie naar Leiden") — die alvast
    // los toepassen, de locatie zelf moet nog via de keuzeknoppen bevestigd worden.
    await pasProfielWijzigingenToe(admin, profiel, chatId, { ...profielParse.wijzigingen, locatieQuery: undefined });
    return NextResponse.json({ ok: true });
  }

  if (profielParse.herkend) {
    const verwerkt = await pasProfielWijzigingenToe(admin, profiel, chatId, profielParse.wijzigingen);
    if (verwerkt) return NextResponse.json({ ok: true });
  }

  // --- Vaste speelmomenten via chat ("zet dinsdag 20:00 als vast moment") ---
  const vastMomentOpdracht = parseVastMomentOpdracht(tekst);
  if (vastMomentOpdracht) {
    const antwoord = await pasVasteMomentToe(admin, profiel.id, vastMomentOpdracht);
    await stuurTelegramBericht(chatId, antwoord);
    return NextResponse.json({ ok: true });
  }

  // --- Actieve onboarding- of locatieflow ---
  if (profiel.telegram_onboarding_stap === "wacht_locatie_onboarding") {
    await vraagLocatieKeuze(admin, profiel.id, chatId, tekst, "wacht_locatie_onboarding", null);
    return NextResponse.json({ ok: true });
  }

  if (profiel.telegram_onboarding_stap === "wacht_tijd_onboarding") {
    if (schoon.includes("geen voorkeur") || schoon === "geen" || schoon === "-") {
      await admin.from("profiles").update({ voorkeurstijd: null, telegram_onboarding_stap: null }).eq("id", profiel.id);
      await stuurTelegramBericht(
        chatId,
        "Prima, geen vaste tijd. Je krijgt een bericht zodra er iets vrijkomt bij een club die je volgt. Aanpassen kan altijd via je Account-pagina, of gewoon hier in de chat."
      );
      return NextResponse.json({ ok: true });
    }
    // extraheerFlexibeleTijd i.p.v. de strengere extraheerTijd (die hierboven
    // nog wel voor de losse zoekopdracht wordt gebruikt) — accepteert ook
    // "2000", "830" of "8" als los antwoord, niet alleen "19:00".
    const tijd = extraheerFlexibeleTijd(tekst, "tijdantwoord");
    if (!tijd) {
      await stuurTelegramBericht(
        chatId,
        'Dat herken ik niet als tijd. Typ bijvoorbeeld "19:00", "1900", "830" of "19". Je kunt ook "geen voorkeur" sturen.'
      );
      return NextResponse.json({ ok: true });
    }
    await admin.from("profiles").update({ voorkeurstijd: tijd, telegram_onboarding_stap: null }).eq("id", profiel.id);
    await stuurTelegramBericht(
      chatId,
      `Genoteerd: rond ${tijd}. Wijzigen kan altijd via je Account-pagina, of gewoon hier in de chat (bv. "zet mijn tijd op 2030").`
    );
    return NextResponse.json({ ok: true });
  }

  if (profiel.telegram_onboarding_stap === "wacht_locatie_adhoc") {
    await vraagLocatieKeuze(admin, profiel.id, chatId, tekst, "wacht_locatie_adhoc", null);
    return NextResponse.json({ ok: true });
  }

  // --- Geen actief gesprek: proberen als losse zoekopdracht te lezen ---
  const zoekopdracht = parseAdhocZoekopdracht(tekst);
  if (zoekopdracht) {
    // parseAdhocZoekopdracht herkent tijden alleen in de striktere vormen
    // (20:00, 20u, om 20, …) om de plaats-extractie niet te verstoren (zie
    // extraheerPlaats in telegramConversatie.ts) — een compacte vorm als
    // "2000" mist die daardoor. Hier als fallback alsnog proberen, zonder de
    // striktere parser zelf aan te passen.
    const flexibeleTijd = zoekopdracht.tijd ?? extraheerFlexibeleTijd(tekst, "zoeken");
    await vraagLocatieKeuze(
      admin,
      profiel.id,
      chatId,
      zoekopdracht.plaatsQuery,
      "wacht_locatie_adhoc",
      flexibeleTijd,
      zoekopdracht.dagOffset
    );
    return NextResponse.json({ ok: true });
  }

  // --- Eenvoudige natuurlijke vragen ---
  if (/\b(wat kan je|wat kun je|wat kan jij|mogelijkheden)\b/.test(schoon)) {
    await stuurHelp(chatId);
    return NextResponse.json({ ok: true });
  }

  if (/\b(bedankt|dankjewel|dank je|top|mooi)\b/.test(schoon)) {
    await stuurTelegramBericht(chatId, "Graag gedaan! Stuur /help om te zien wat ik voor je kan doen.");
    return NextResponse.json({ ok: true });
  }

  await stuurTelegramBericht(
    chatId,
    [
      "Dat snap ik nog niet helemaal.",
      'Probeer bijvoorbeeld: "zoek een baan in Haarlem rond 2000",',
      '"maak mijn straal 5 km", of "zet dinsdag 20:00 als vast moment".',
      "Stuur /help voor alle mogelijkheden.",
    ].join("\n")
  );
  return NextResponse.json({ ok: true });
}
