"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Client-side inlogstatus, gedeeld door Navigatie en de homepage-hero (4 aug
 * 2026, Xander: "maak ook een inlog mogelijkheid op de homepage" + "zorg dat
 * ik ook ergens kan uitloggen").
 *
 * Bewust GEEN server-side check in layout.tsx/page.tsx: supabaseServer()
 * leest cookies(), en dat zet elke pagina die het aanroept om naar dynamic
 * rendering — precies wat we net vermeden hebben door de stad-pagina's als
 * statische SSG te bouwen. Deze hook haalt de sessie in de browser op (al
 * lokaal gecached door supabase-js), dus layout/page blijven statisch.
 *
 * Retourneert `undefined` zolang de eerste check nog loopt (voorkomt een
 * "Inloggen" → "Account" flits bij binnenkomst), daarna `null` (uitgelogd)
 * of de `User`.
 */
export function useGebruiker(): User | null | undefined {
  const [gebruiker, setGebruiker] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data }) => setGebruiker(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setGebruiker(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return gebruiker;
}
