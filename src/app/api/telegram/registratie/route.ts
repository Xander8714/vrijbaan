import { NextRequest, NextResponse } from "next/server";
import { stuurTelegramBericht } from "@/lib/telegram";

/**
 * Meldt een nieuwe registratie via Telegram aan TELEGRAM_CHAT_ID — Xander (3
 * aug 2026): "ik wil een notificatie als eigenaar als personen zich hebben
 * aangemeld, dan kan ik ze daarna een pro account aanbieden". Aangeroepen
 * vanuit src/app/login/page.tsx direct na een geslaagde supabase.auth.signUp.
 *
 * Los van de per-club-notificaties in scripts/poll-availability.ts: dit is
 * geen zoekmelding maar een eigenaarsmelding, dus een eigen kleine route
 * i.p.v. TELEGRAM_CHAT_ID daar bij te laten haken.
 *
 * TELEGRAM_CHAT_ID staat nog leeg in .env.local (lokaal én op de VPS) — tot
 * die gezet is, logt dit alleen server-side (zie stuurTelegramBericht) en
 * gebeurt er verder niets zichtbaars. Geen foutmelding naar de gebruiker:
 * een mislukte eigenaarsmelding mag een registratie nooit blokkeren.
 */
export async function POST(request: NextRequest) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return NextResponse.json({ ok: true });

  let email = "onbekend e-mailadres";
  try {
    const body = (await request.json()) as { email?: string };
    if (typeof body.email === "string" && body.email.trim()) email = body.email.trim();
  } catch {
    // Geen/ongeldige body — melden met "onbekend e-mailadres" is beter dan niets melden.
  }

  await stuurTelegramBericht(chatId, `Nieuwe registratie op VrijeBaan: ${email}`);
  return NextResponse.json({ ok: true });
}
