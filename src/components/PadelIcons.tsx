/**
 * Kleine, herbruikbare lijn-iconen met een padel-thema (racket + bal).
 *
 * Bewust simpele lijntekeningen (geen fotorealistische illustraties) — dat
 * oogt professioneel op kleine formaten (nav, badges, bullets) en blijft
 * scherp op elke schaal omdat het SVG is. `currentColor` voor de lijnen zodat
 * elk icoon meekleurt met de tekstkleur van de plek waar hij staat; de bal
 * heeft er daarnaast een eigen fill-kleur (standaard het bal-geel uit het
 * palet) omdat een gevulde bal duidelijker leest dan een outline-bal op klein
 * formaat.
 */

export function RacketIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <ellipse cx="12" cy="8.5" rx="6.5" ry="7.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.3 4.2c2 1.6 3 3.7 3 6.3M16.7 4.2c-2 1.6-3 3.7-3 6.3M6 8.5h12M12 1v7.5" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <path d="M11 15.8 6.4 21.9M9.6 14.7 5 20.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BalIcon({ className = "h-5 w-5", kleur = "var(--color-ball-400)" }: { className?: string; kleur?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill={kleur} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      <path
        d="M4 6.5c3 2 5 5 5 9M20 6.5c-3 2-5 5-5 9"
        fill="none"
        stroke="var(--color-ball-900)"
        strokeOpacity="0.55"
        strokeWidth="1.3"
      />
    </svg>
  );
}
