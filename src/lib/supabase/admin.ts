import { createClient } from "@supabase/supabase-js";
// Service-role client — ALLEEN server-side gebruiken (bv. in de webhook). Omzeilt RLS.
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
