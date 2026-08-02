import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stuurTelegramBericht } from "@/lib/telegram";
import {
  bouwLocatieKeyboard,
  extraheerTijd,
  parseAdhocZoekopdracht,
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

type TelegramKandidaten = { kandidaten: GevondenLocatie[]; tijd?: string | null };
type Admin = ReturnType<typeof supabaseAdmin>;

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
  stap: "wacht_locatie_onboarding" | "wacht_locatie_adhoc",
  tijdVoorAdhoc: string | null
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
  const opslag: TelegramKandidaten = { kandidaten, tijd: tijdVoorAdhoc };
  await admin
    .from("profiles")
    .update({ telegram_onboarding_stap: stap, telegram_kandidaten: opslag })
    .eq("id", profielId);
  await stuurLocatieKeuze(chatId, "Bedoel je een van deze?", kandidaten);
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
    if (!chatId || !data?.startsWith("loc:")) return NextResponse.json({ ok: true });

    const { data: profiel } = await admin
      .from("profiles")
      .select("id, telegram_onboarding_stap, telegram_kandidaten")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();
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
      const antwoord = await zoekBeschikbaarheidVoorChat(kandidaat, naam, opgeslagen?.tijd ?? null, SITE_URL);
      await stuurTelegramBericht(chatId, antwoord);
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
  const { data: profiel } = await admin
    .from("profiles")
    .select("id, telegram_onboarding_stap")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (!profiel) {
    await stuurTelegramBericht(
      chatId,
      "Ik ken dit gesprek nog niet. Koppel eerst via de knop 'Koppel Telegram' op je Account-pagina in VrijeBaan."
    );
    return NextResponse.json({ ok: true });
  }

  if (profiel.telegram_onboarding_stap === "wacht_locatie_onboarding") {
    await vraagLocatieKeuze(admin, profiel.id, chatId, tekst, "wacht_locatie_onboarding", null);
    return NextResponse.json({ ok: true });
  }

  if (profiel.telegram_onboarding_stap === "wacht_tijd_onboarding") {
    const schoon = tekst.toLowerCase();
    if (schoon.includes("geen voorkeur") || schoon === "geen" || schoon === "-") {
      await admin.from("profiles").update({ voorkeurstijd: null, telegram_onboarding_stap: null }).eq("id", profiel.id);
      await stuurTelegramBericht(
        chatId,
        "Prima, geen vaste tijd. Je krijgt een bericht zodra er iets vrijkomt bij een club binnen je straal. Aanpassen kan altijd via je Account-pagina."
      );
      return NextResponse.json({ ok: true });
    }
    const tijd = extraheerTijd(tekst);
    if (!tijd) {
      await stuurTelegramBericht(chatId, 'Dat herken ik niet als tijd. Typ bijvoorbeeld "19:00", of stuur "geen voorkeur".');
      return NextResponse.json({ ok: true });
    }
    await admin.from("profiles").update({ voorkeurstijd: tijd, telegram_onboarding_stap: null }).eq("id", profiel.id);
    await stuurTelegramBericht(
      chatId,
      `Genoteerd: rond ${tijd}. Je krijgt een bericht zodra er een plek vrijkomt binnen je straal rond die tijd. Wijzigen kan altijd via je Account-pagina.`
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
    await vraagLocatieKeuze(admin, profiel.id, chatId, zoekopdracht.plaatsQuery, "wacht_locatie_adhoc", zoekopdracht.tijd);
    return NextResponse.json({ ok: true });
  }

  await stuurTelegramBericht(
    chatId,
    'Dat snap ik niet. Probeer bijvoorbeeld "zoek een baan in Haarlem rond 20:00", of pas je voorkeuren aan via je Account-pagina in VrijeBaan.'
  );
  return NextResponse.json({ ok: true });
}
