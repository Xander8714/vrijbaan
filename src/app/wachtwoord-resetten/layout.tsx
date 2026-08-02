import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wachtwoord resetten", robots: { index: false, follow: false } };

export default function WachtwoordResettenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
