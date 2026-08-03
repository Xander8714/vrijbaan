import Link from "next/link";

// Zelfde paginalijst als Navigatie.tsx, plus /telegram (die staat niet in de
// hoofdnav) — Xander (3 aug 2026): "zet de sitemap en contact onder alle
// pagina's". "Club aanmelden" blijft hier ook weg zolang die uit de hoofdnav
// staat (zie de toelichting in Navigatie.tsx).
const SITEMAP_LINKS = [
  { href: "/", label: "Home" },
  { href: "/radar", label: "Radar" },
  { href: "/pricing", label: "Prijzen" },
  { href: "/help", label: "Help" },
  { href: "/telegram", label: "Telegram-bot" },
  { href: "/account", label: "Account" },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-ink-800 bg-ink-900 text-slate-300">
      <div className="mx-auto grid max-w-4xl gap-8 px-6 py-10 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Sitemap</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {SITEMAP_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Contact</h2>
          <p className="mt-3 text-sm">
            Vraag over hoe iets werkt, of een bug gevonden?{" "}
            <a href="mailto:support@devrijebaan.nl" className="text-ball-400 hover:underline">
              support@devrijebaan.nl
            </a>
          </p>
          <p className="mt-2 text-sm">
            Algemene vragen of samenwerkingen:{" "}
            <a href="mailto:info@devrijebaan.nl" className="text-ball-400 hover:underline">
              info@devrijebaan.nl
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-ink-800 px-6 py-4 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} VrijeBaan
      </div>
    </footer>
  );
}
