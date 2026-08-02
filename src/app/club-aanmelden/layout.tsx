import type { Metadata } from "next";

// club-aanmelden/page.tsx is "use client", zie de toelichting in radar/layout.tsx.
export const metadata: Metadata = {
  title: "Club aanmelden",
  description: "Ben jij een padelclub? Meld je aan bij VrijeBaan en laat spelers in jouw omgeving je vrije banen live terugvinden. Aanmelden is gratis.",
  alternates: { canonical: "/club-aanmelden" },
};

export default function ClubAanmeldenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
