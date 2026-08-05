import type { Metadata } from "next";

// radar/page.tsx is "use client" (useState voor filters), dus metadata kan
// daar niet direct in — vandaar deze losse server-layout eromheen, het
// standaard Next.js-patroon voor dit geval.
export const metadata: Metadata = {
  title: "Padel Radar — gratis testen na registratie",
  description:
    "VrijeBaan zit in de testfase. Registreer gratis en bekijk met de Radar live welke padelbanen bij jou in de buurt vrij zijn.",
  robots: { index: false, follow: false },
};

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
