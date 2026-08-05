import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SocialMediaAdmin = { id: string; email: string };
export type GebruikersStatistieken = { geregistreerd: number; online: number };

function toegestaneEmails(): Set<string> {
  return new Set(
    (process.env.SOCIAL_MEDIA_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function haalSocialMediaAdmin(): Promise<SocialMediaAdmin | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email || !toegestaneEmails().has(email)) return null;
  return { id: user.id, email };
}

/**
 * Zelfde check als haalSocialMediaAdmin(), maar vanuit de Telegram-webhook
 * (5 aug 2026, Xander: "laat die goedkeuring lopen via de telegram bot") —
 * daar is geen ingelogde sessie/cookie, dus geen supabaseServer(). In plaats
 * daarvan: zoek het profiel bij deze chat_id op en toets hetzelfde
 * SOCIAL_MEDIA_ADMIN_EMAILS-lijstje. Zo kan een goedkeuring via Telegram
 * nooit een ander antwoord geven dan de webpagina — precies dezelfde
 * geest als api/account/navigatie/route.ts's Beheer-tabblad-check.
 */
export async function haalSocialMediaAdminViaChatId(chatId: number): Promise<SocialMediaAdmin | null> {
  const { data, error } = await supabaseAdmin()
    .from("profiles")
    .select("id, email")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (error || !data?.email) return null;
  const email = (data.email as string).toLowerCase();
  if (!toegestaneEmails().has(email)) return null;
  return { id: data.id as string, email };
}

export async function vereisSocialMediaAdmin(): Promise<SocialMediaAdmin> {
  const admin = await haalSocialMediaAdmin();
  if (!admin) throw new Error("Niet bevoegd voor socialmediabeheer.");
  return admin;
}

export async function haalGebruikersStatistieken(): Promise<GebruikersStatistieken> {
  const grens = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const admin = supabaseAdmin();
  const [totaalResultaat, onlineResultaat] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen_at", grens),
  ]);

  if (totaalResultaat.error) throw totaalResultaat.error;
  if (onlineResultaat.error) throw onlineResultaat.error;
  return {
    geregistreerd: totaalResultaat.count ?? 0,
    online: onlineResultaat.count ?? 0,
  };
}
