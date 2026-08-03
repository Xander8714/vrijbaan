import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Profiel, VastSpeelmoment } from "@/lib/types";
import { CLUBS_INCLUSIEF_LEDENCLUBS } from "@/lib/clubs";
import ProfielFormulier from "./ProfielFormulier";
import TelegramKoppelen from "./TelegramKoppelen";
import VasteMomenten from "./VasteMomenten";

// Privé, achter inloggen — niets hier is nuttig voor een zoekmachine.
export const metadata: Metadata = { title: "Mijn account", robots: { index: false, follow: false } };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welkom?: string }>;
}) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { welkom } = await searchParams;

  const [{ data: rij }, { data: momentenRijen }, { data: gevolgdRijen }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "subscription_status, voornaam, achternaam, speelsterkte, speelsterkte_bron, bondsnummer, straat, huisnummer, postcode, woonplaats, lat, lon, zoekstraal_km, lidmaatschappen, telefoon, telegram_chat_id"
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("vaste_speelmomenten")
      .select("id, dag, tijd, gemeld")
      .eq("profile_id", user.id)
      .order("dag")
      .order("tijd"),
    supabase.from("gevolgde_clubs").select("club_id").eq("user_id", user.id),
  ]);

  const status = rij?.subscription_status ?? "free";

  const beginMomenten: VastSpeelmoment[] = (momentenRijen ?? []).map((m) => ({
    id: m.id as string,
    dag: m.dag as number,
    tijd: m.tijd as string,
    gemeld: m.gemeld as boolean,
  }));

  // Namen erbij zoeken voor weergave — gevolgde_clubs zelf bevat alleen id's.
  const favorieteClubs = (gevolgdRijen ?? [])
    .map((r) => CLUBS_INCLUSIEF_LEDENCLUBS.find((c) => c.id === r.club_id))
    .filter((c): c is (typeof CLUBS_INCLUSIEF_LEDENCLUBS)[number] => c !== undefined)
    .map((c) => ({ id: c.id, naam: c.naam, plaats: c.plaats }));

  // Zet de databasekolommen om naar het Profiel-type. Bestaande accounts
  // hebben deze kolommen nog niet gevuld, dus alles valt terug op null.
  const profiel: Profiel = {
    voornaam: rij?.voornaam ?? null,
    achternaam: rij?.achternaam ?? null,
    speelsterkte: rij?.speelsterkte ?? null,
    speelsterkteBron: rij?.speelsterkte_bron ?? null,
    bondsnummer: rij?.bondsnummer ?? null,
    straat: rij?.straat ?? null,
    huisnummer: rij?.huisnummer ?? null,
    postcode: rij?.postcode ?? null,
    woonplaats: rij?.woonplaats ?? null,
    lat: rij?.lat ?? null,
    lon: rij?.lon ?? null,
    zoekstraalKm: rij?.zoekstraal_km ?? 10,
    lidmaatschappen: rij?.lidmaatschappen ?? [],
    telefoon: rij?.telefoon ?? null,
  };

  const volledigeNaam = [profiel.voornaam, profiel.achternaam].filter(Boolean).join(" ");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Mijn account</h1>
      <p className="mt-1 text-slate-600">{volledigeNaam || user.email}</p>

      {welkom === "1" && !rij?.telegram_chat_id && (
        <p className="mt-4 rounded-lg border border-court-200 bg-court-50 px-4 py-3 text-sm text-court-900">
          Welkom bij VrijeBaan! Laatste stap: koppel Telegram hieronder, dan krijg je automatisch een berichtje
          zodra er een padelbaan vrijkomt.
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">E-mailadres</p>
          <p className="mt-1 font-medium text-slate-900">{user.email}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Abonnement</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{status === "pro" ? "Pro ✓" : "Gratis"}</p>
          {status !== "pro" && (
            <Link href="/pricing" className="mt-2 inline-block rounded-md bg-court-600 px-4 py-2 text-sm font-medium text-white hover:bg-court-700">
              Upgrade naar Pro
            </Link>
          )}
        </div>
      </div>

      {/* Vóór het profielformulier — Xander (3 aug 2026): dit is de stap die
          een nieuwe gebruiker daadwerkelijk terug laat komen (meldingen), dus
          die hoort bovenaan, niet achter een lang profielformulier verstopt. */}
      <div className="mt-6">
        <TelegramKoppelen userId={user.id} beginChatId={rij?.telegram_chat_id ?? null} />
      </div>

      <ProfielFormulier userId={user.id} beginProfiel={profiel} />

      <div className="mt-6">
        <VasteMomenten userId={user.id} beginMomenten={beginMomenten} favorieteClubs={favorieteClubs} />
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Je adres wordt alleen gebruikt om clubs binnen je zoekstraal te vinden. Wil je dat niet, laat de
        locatievelden dan leeg — de Radar toont dan gewoon alle clubs.
      </p>
    </main>
  );
}
