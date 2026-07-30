import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stuurTelegramBericht } from "@/lib/telegram";

/**
 * Ontvangt Telegram-updates voor @vrijbaan_notify_bot (geregistreerd via
 * setWebhook, zie PROJECTPLAN.md). Verwerkt alleen `/start <code>`: de
 * Account-pagina genereert die code en zet 'm in de deep link
 * (t.me/vrijbaan_notify_bot?start=<code>); hier zoeken we het profiel met
 * die code op en koppelen we `telegram_chat_id`.
 *
 * BEVEILIGING: Telegram stuurt de secret die bij setWebhook is opgegeven mee
 * in de X-Telegram-Bot-Api-Secret-Token header. Zonder die check zou iedereen
 * die deze URL kent een willekeurige chat_id aan een willekeurige koppelcode
 * kunnen plakken.
 *
 * Geeft altijd 200 terug op een geldige Telegram-update (ook bij een
 * onbekende/verlopen code) — Telegram blijft anders retryen, en de gebruiker
 * krijgt de foutmelding toch al terug als chatbericht.
 */
export const runtime = "nodejs";

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
  };
};

export async function POST(req: NextRequest) {
  const verwachteSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const ontvangenSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!verwachteSecret || ontvangenSecret !== verwachteSecret) {
    return NextResponse.json({ error: "Ongeldige of ontbrekende secret." }, { status: 401 });
  }

  const update = (await req.json()) as TelegramUpdate;
  const tekst = update.message?.text?.trim();
  const chatId = update.message?.chat.id;
  if (!tekst || !chatId) {
    return NextResponse.json({ ok: true });
  }

  const match = /^\/start(?:\s+(\S+))?/.exec(tekst);
  if (!match) {
    return NextResponse.json({ ok: true });
  }

  const code = match[1];
  if (!code) {
    await stuurTelegramBericht(
      chatId,
      "Open deze bot via de knop 'Koppel Telegram' op je Account-pagina in VrijBaan — dan koppel ik automatisch aan je account."
    );
    return NextResponse.json({ ok: true });
  }

  const admin = supabaseAdmin();
  const { data: profiel, error: zoekFout } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_koppel_code", code)
    .maybeSingle();

  if (zoekFout || !profiel) {
    await stuurTelegramBericht(
      chatId,
      "Deze koppelcode ken ik niet (meer). Vraag op je Account-pagina een nieuwe koppellink op."
    );
    return NextResponse.json({ ok: true });
  }

  // Code is eenmalig: meteen leegmaken zodra hij gebruikt wordt, ongeacht of
  // de update daarna slaagt — een gelekte/oude deep link mag niet nogmaals
  // bruikbaar zijn.
  const { error: updateFout } = await admin
    .from("profiles")
    .update({ telegram_chat_id: chatId, telegram_koppel_code: null })
    .eq("id", profiel.id);

  if (updateFout) {
    // Meest waarschijnlijke oorzaak: deze chat is al aan een ANDER profiel
    // gekoppeld (unique index op telegram_chat_id) — geen bug, dus een
    // begrijpelijk bericht in plaats van een generieke foutmelding.
    const dubbeleChat = /duplicate key|unique/i.test(updateFout.message);
    await stuurTelegramBericht(
      chatId,
      dubbeleChat
        ? "Deze Telegram-chat is al aan een ander VrijBaan-account gekoppeld."
        : "Koppelen is mislukt. Vraag op je Account-pagina een nieuwe koppellink op."
    );
    return NextResponse.json({ ok: true });
  }

  await stuurTelegramBericht(
    chatId,
    "Gekoppeld! Je krijgt hier voortaan een bericht zodra een club die je volgt een nieuwe padel-plek vrijgeeft."
  );
  return NextResponse.json({ ok: true });
}
