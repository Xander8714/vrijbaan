"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Vaste tabbladen bovenaan elke pagina.
//
// Opstelling is bewust verwijderd (29 juli 2026, besluit Xander: "past niet
// meer bij de app"). De route zelf (src/app/opstelling) is verwijderd; het
// rekenmodel (src/lib/lineup.ts + tests) blijft staan — dat wordt al herbruikt
// in de mobiele app (zie PROJECTPLAN.md §9.1), dus daar is niets mis mee.
const TABBLADEN = [
  { href: "/radar", label: "Radar" },
  { href: "/account", label: "Account" },
  { href: "/pricing", label: "Prijzen" },
  { href: "/help", label: "Help" },
  // "Club aanmelden" tijdelijk uit de navigatie (3 aug 2026, Xander: "zet de
  // club aanmelden nog even uit, niet verwijderen maar even niet tonen") —
  // de route/pagina zelf blijft gewoon bestaan, dus terugzetten is later
  // gewoon deze regel weer toevoegen.
  // { href: "/club-aanmelden", label: "Club aanmelden" },
];

export default function Navigatie() {
  const pad = usePathname();
  const [open, setOpen] = useState(false);

  // Menu dicht bij het wisselen van pagina — anders blijft een opengeklapt
  // hamburgermenu staan na het kiezen van een tabblad. Dit is bewust GEEN
  // useEffect (react-hooks/set-state-in-effect verbiedt setState direct in
  // een effect-body): het bijstellen van state tijdens het renderen zelf,
  // zodra `pad` verandert, is het door React aanbevolen patroon hiervoor.
  const [vorigPad, setVorigPad] = useState(pad);
  if (pad !== vorigPad) {
    setVorigPad(pad);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-20 bg-ink-900">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Vrije<span className="text-ball-400">Baan</span>
        </Link>

        {/* Vanaf sm: gewone horizontale tabbladen. Daaronder verstopt achter
            de hamburgerknop — 5 tabbladen náást een logo past niet meer op
            een telefoonbreedte zonder te knijpen of af te breken. */}
        <div className="hidden items-center gap-x-1 sm:flex">
          {TABBLADEN.map((tab) => (
            <Tabblad key={tab.href} href={tab.href} label={tab.label} actief={isActief(pad, tab.href)} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobiel-menu"
          aria-label={open ? "Sluit menu" : "Open menu"}
          className="flex h-9 w-9 items-center justify-center rounded-md text-white sm:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </nav>

      {open && (
        <div id="mobiel-menu" className="border-t border-ink-700 px-6 pb-4 sm:hidden">
          <div className="flex flex-col gap-1 pt-3">
            {TABBLADEN.map((tab) => (
              <Tabblad key={tab.href} href={tab.href} label={tab.label} actief={isActief(pad, tab.href)} volledigeBreedte />
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function isActief(pad: string, href: string): boolean {
  return pad === href || pad.startsWith(`${href}/`);
}

function Tabblad({ href, label, actief, volledigeBreedte }: { href: string; label: string; actief: boolean; volledigeBreedte?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={actief ? "page" : undefined}
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${volledigeBreedte ? "block" : ""} ${
        actief ? "bg-court-600 text-white" : "text-slate-300 hover:bg-ink-700 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}
