import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profiel } = await supabase.from("profiles").select("subscription_status").eq("id", user.id).single();
  const status = profiel?.subscription_status ?? "free";
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <Link href="/" className="text-sm text-emerald-700 hover:underline">&larr; Terug</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Mijn account</h1>
      <p className="mt-2 text-slate-600">{user.email}</p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Abonnement</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{status === "pro" ? "Pro ✓" : "Gratis"}</p>
        {status !== "pro" && (<Link href="/pricing" className="mt-3 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Upgrade naar Pro</Link>)}
      </div>
    </main>
  );
}
