import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Profiel } from "@/lib/types";
import ProfielFormulier from "./ProfielFormulier";

export default async function AccountPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rij } = await supabase
    .from("profiles")
    .select(
      "subscription_status, voornaam, achternaam, speelsterkte, speelsterkte_bron, bondsnummer, straat, huisnummer, postcode, woonplaats, lat, lon, zoekstraal_km, lidmaatschappen"
    )
    .eq("id", user.id)
    .single();

  const status = rij?.subscription_status ?? "free";

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
  };

  const volledigeNaam = [profiel.voornaam, profiel.achternaam].filter(Boolean).join(" ");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Mijn account</h1>
      <p className="mt-1 text-slate-600">{volledigeNaam || user.email}</p>

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

      <ProfielFormulier userId={user.id} beginProfiel={profiel} />

      <p className="mt-8 text-xs text-slate-400">
        Je adres wordt alleen gebruikt om clubs binnen je zoekstraal te vinden. Wil je dat niet, laat de
        locatievelden dan leeg — de Radar toont dan gewoon alle clubs.
      </p>
    </main>
  );
}
