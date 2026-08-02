import type { Metadata } from "next";

// radar/page.tsx is "use client" (useState voor filters), dus metadata kan
// daar niet direct in — vandaar deze losse server-layout eromheen, het
// standaard Next.js-patroon voor dit geval.
export const metadata: Metadata = {
  title: "Padel Radar — live beschikbaarheid bij jou in de buurt",
  description:
    "Zoek padelbanen op adres en straal, filter op dag en tijd, en zie live welke banen vrij zijn bij Playtomic-, KNLTB Meet & Play- en Peakz-clubs — tot een week vooruit.",
  alternates: { canonical: "/radar" },
};

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
