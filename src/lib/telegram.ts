/**
 * Dunne client voor de Telegram Bot API — gedeeld door de webhook-route
 * (src/app/api/telegram/webhook) en scripts/poll-availability.ts, zodat er
 * niet op twee plekken dezelfde fetch-aanroep staat.
 */
export async function stuurTelegramBericht(chatId: number | string, tekst: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN niet gezet — alleen loggen:", tekst);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: tekst, disable_web_page_preview: true }),
  });
  if (!res.ok) {
    console.error(`[telegram] Bericht naar ${chatId} versturen mislukt:`, res.status, await res.text());
  }
}

/**
 * Zelfde als stuurTelegramBericht, maar met een inline keyboard (rijen van
 * knoppen) — voor de socialmedia-goedkeuring via Telegram (5 aug 2026, zie
 * lib/socialMedia/telegramGoedkeuring.ts). De webhook-route had al een eigen
 * ad-hoc variant hiervan voor locatiekeuzeknoppen (stuurLocatieKeuze); die
 * laten we ongemoeid en losstaand — deze functie is specifiek voor het
 * generieke "tekst + rijen knoppen"-geval dat de socialmedia-flow nodig
 * heeft.
 */
export async function stuurTelegramBerichtMetKnoppen(
  chatId: number | string,
  tekst: string,
  knoppen: Array<Array<{ text: string; callback_data: string }>>
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN niet gezet — alleen loggen:", tekst);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: tekst,
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: knoppen },
    }),
  });
  if (!res.ok) {
    console.error(`[telegram] Bericht met knoppen naar ${chatId} versturen mislukt:`, res.status, await res.text());
  }
}
