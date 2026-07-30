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
