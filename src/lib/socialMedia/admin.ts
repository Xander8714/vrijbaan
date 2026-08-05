import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

export type SocialMediaAdmin = { id: string; email: string };

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

export async function vereisSocialMediaAdmin(): Promise<SocialMediaAdmin> {
  const admin = await haalSocialMediaAdmin();
  if (!admin) throw new Error("Niet bevoegd voor socialmediabeheer.");
  return admin;
}
