import "server-only";

import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Vangnet voor OAuth-aanmeldingen. De database-trigger is de primaire route,
 * maar een callback mag nooit eindigen met alleen een auth.users-rij.
 */
export async function zorgVoorProfiel(user: User): Promise<void> {
  if (!user.email) return;

  const metadata = user.user_metadata ?? {};
  const { error } = await supabaseAdmin()
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email,
      voornaam: typeof metadata.given_name === "string" ? metadata.given_name : null,
      achternaam: typeof metadata.family_name === "string" ? metadata.family_name : null,
    }, { onConflict: "id", ignoreDuplicates: true });

  // Een profielprobleem blokkeert de geldige OAuth-sessie niet, maar blijft
  // wel zichtbaar in de serverlogs zodat het direct te onderzoeken is.
  if (error) console.error("Profiel aanmaken na OAuth is mislukt", error.message);
}
