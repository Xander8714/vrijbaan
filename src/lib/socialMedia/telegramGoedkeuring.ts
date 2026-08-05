import { stuurTelegramBerichtMetKnoppen } from "@/lib/telegram";
import type { GegenereerdConcept } from "./types";

// Bewust geen `import "server-only"`: deze module draait uitsluitend via
// servercode, maar wordt ook door de losse systemd/tsx-generator geladen.
// De Next.js-only guard gooit buiten de React Server-runtime direct een fout.

/**
 * Stuurt een goedkeuringsverzoek naar Xanders eigen Telegram-chat zodra een
 * nieuw concept is opgeslagen (5 aug 2026, Xander: "laat die goedkeuring
 * lopen via de telegram bot aan het telefoonnummer 0641189536" — dat nummer
 * is al gekoppeld aan zijn account, TELEGRAM_CHAT_ID is de chat_id
 * daarvan). De beheerpagina (/beheer/social-media) blijft gewoon werken
 * ernaast — dit is een snellere, extra weg, geen vervanging.
 *
 * Bewust GEEN afbeelding meegestuurd: het live cijfer/tekst staat al in de
 * caption hieronder (waar het om gaat voor snelle goedkeuring), en de
 * afbeelding zelf is prima te controleren via de link naar de beheerpagina —
 * die toont 'm inmiddels op leesbare grootte (5 aug 2026: "ik heb wel de
 * grotere plaatjes nodig ... spellingscontrole"). Een afbeelding via
 * Telegram sturen kan (sendPhoto), maar is bewust uitgesteld: dat vraagt een
 * aparte multipart-upload i.p.v. de simpele JSON-berichten die hier al
 * overal gebruikt worden, en voegt nu geen functionaliteit toe die de
 * beheerpagina niet al heeft.
 *
 * Faalt bewust nooit hard: zonder TELEGRAM_CHAT_ID (nog leeg in .env.local/
 * VPS tot Xander 'm instelt, zie api/telegram/registratie/route.ts) of bij
 * een verstuurfout blijft de beheerpagina de weg om goed te keuren — een
 * concept mag nooit onopgemerkt blijven staan puur omdat deze melding faalde.
 */
export async function meldNieuwConceptViaTelegram(
  id: string,
  concept: Pick<GegenereerdConcept, "caption" | "contentType">
): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn(
      "[social-media] TELEGRAM_CHAT_ID niet gezet — geen Telegram-goedkeuringsverzoek verstuurd, alleen via /beheer/social-media."
    );
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vrijbaan.vercel.app";
  const label = concept.contentType === "statistic" ? "📊 Nieuwe tellingpost" : "🎾 Nieuw beschikbaarheidsconcept";
  const tekst =
    `${label} klaar voor goedkeuring:\n\n${concept.caption}\n\n` +
    `Afbeelding bekijken: ${siteUrl}/beheer/social-media`;

  try {
    await stuurTelegramBerichtMetKnoppen(chatId, tekst, [
      [
        { text: "✅ Goedkeuren", callback_data: `smgoed:${id}` },
        { text: "❌ Afwijzen", callback_data: `smafw:${id}` },
      ],
    ]);
  } catch (fout) {
    console.error("[social-media] Telegram-goedkeuringsverzoek versturen mislukt:", fout);
  }
}
