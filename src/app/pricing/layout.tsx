import type { Metadata } from "next";

// pricing/page.tsx is "use client", zie de toelichting in radar/layout.tsx.
export const metadata: Metadata = {
  title: "Prijzen",
  description: "Gratis om te proberen — betaal alleen als je meerdere clubs en teams wilt volgen.",
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
