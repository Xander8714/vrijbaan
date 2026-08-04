"use client";
import Link from "next/link";
import { useGebruiker } from "@/lib/useGebruiker";

// Losse client-island in de (verder statische) hero — zie de toelichting in
// useGebruiker.ts voor waarom dit geen server-side check is.
export default function HeroInlogKnop() {
  const gebruiker = useGebruiker();

  if (gebruiker === undefined) {
    // Nog aan het laden: vaste breedte/hoogte reserveren zodat de knoppenrij
    // niet springt zodra dit binnen komt.
    return <span className="rounded-md px-5 py-2.5 text-sm font-medium text-transparent">Inloggen</span>;
  }

  return gebruiker ? (
    <Link
      href="/account"
      className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
    >
      Mijn account →
    </Link>
  ) : (
    <Link
      href="/login"
      className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
    >
      Inloggen
    </Link>
  );
}
