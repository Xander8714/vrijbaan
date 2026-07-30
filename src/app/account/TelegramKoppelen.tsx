"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

/** Korte, URL-veilige eenmalige code voor de /start-deep-link — geen wachtwoord, dus geen zware eisen. */
function genereerKoppelCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Koppelt de Telegram-bot @vrijbaan_notify_bot aan dit account via een
 * deep link (t.me/<bot>?start=<code>). De code wordt hier gegenereerd en
 * opgeslagen op het profiel; de webhook (src/app/api/telegram/webhook) zoekt
 * 'm op zodra de gebruiker de bot start en zet dan telegram_chat_id.
 *
 * Na het klikken kan deze pagina niet weten of het koppelen gelukt is (dat
 * gebeurt in Telegram, niet hier) — daarom kort pollen na de klik, zodat het
 * scherm vanzelf bijwerkt zonder dat de gebruiker zelf hoeft te verversen.
 */
export default function TelegramKoppelen({
  userId,
  beginChatId,
}: {
  userId: string;
  beginChatId: number | null;
}) {
  const [chatId, setChatId] = useState(beginChatId);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [wachtOpBevestiging, setWachtOpBevestiging] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const controleerStatus = async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase.from("profiles").select("telegram_chat_id").eq("id", userId).single();
    if (data?.telegram_chat_id) {
      setChatId(data.telegram_chat_id as number);
      setWachtOpBevestiging(false);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  };

  const startKoppelen = async () => {
    if (!BOT_USERNAME) {
      setFout("Telegram-koppeling is nog niet geconfigureerd (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ontbreekt).");
      return;
    }
    setFout(null);
    setBezig(true);
    const code = genereerKoppelCode();
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("profiles").update({ telegram_koppel_code: code }).eq("id", userId);
    setBezig(false);
    if (error) {
      setFout(`Koppelen starten mislukt: ${error.message}`);
      return;
    }
    window.open(`https://t.me/${BOT_USERNAME}?start=${code}`, "_blank", "noopener,noreferrer");
    setWachtOpBevestiging(true);
    // 20 keer om de 3s controleren (1 minuut) — daarna stopt het vanzelf, de
    // knop "Ik heb de bot gestart" blijft dan gewoon beschikbaar.
    let pogingen = 0;
    pollRef.current = setInterval(() => {
      pogingen += 1;
      controleerStatus();
      if (pogingen >= 20 && pollRef.current) clearInterval(pollRef.current);
    }, 3000);
  };

  const ontkoppelen = async () => {
    setBezig(true);
    setFout(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.from("profiles").update({ telegram_chat_id: null }).eq("id", userId);
    setBezig(false);
    if (error) { setFout(`Ontkoppelen mislukt: ${error.message}`); return; }
    setChatId(null);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">Telegram-meldingen</h2>
      <p className="mt-1 text-sm text-slate-600">
        Volg je een club op de Radar? Koppel Telegram, dan krijg je daar automatisch een bericht zodra er een nieuwe
        plek vrijkomt.
      </p>

      {chatId ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-court-50 px-3 py-1.5 text-sm font-medium text-court-800">Gekoppeld ✓</span>
          <button onClick={ontkoppelen} disabled={bezig}
            className="text-sm font-medium text-slate-500 hover:text-red-600 disabled:opacity-50">
            Ontkoppelen
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <button onClick={startKoppelen} disabled={bezig}
            className="rounded-md bg-court-600 px-4 py-2 text-sm font-medium text-white hover:bg-court-700 disabled:opacity-50">
            {bezig ? "Bezig…" : "Koppel Telegram"}
          </button>
          {wachtOpBevestiging && (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs text-slate-500">
                Telegram is geopend — druk daar op Start. Dit scherm werkt vanzelf bij.
              </p>
              <button onClick={controleerStatus} className="text-xs font-medium text-court-700 hover:underline">
                Nu controleren
              </button>
            </div>
          )}
        </div>
      )}
      {fout && <p className="mt-2 text-sm text-red-600">{fout}</p>}
    </section>
  );
}
