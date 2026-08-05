import type { SocialVisual } from "./types";

function escapeXml(waarde: string): string {
  return waarde.replace(/[<>&\"']/g, (teken) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[teken]!);
}

function kortTekst(waarde: string, maximum: number): string {
  return waarde.length <= maximum ? waarde : `${waarde.slice(0, maximum - 1).trimEnd()}…`;
}

export function renderSocialVisualSvg(visual: SocialVisual): string {
  const tijden = visual.times
    .slice(0, 5)
    .map((tijd, index) => {
      const x = 90 + (index % 3) * 290;
      const y = 650 + Math.floor(index / 3) * 130;
      return `<g><rect x="${x}" y="${y}" width="245" height="92" rx="46" fill="#ccff33"/><text x="${x + 122.5}" y="${y + 61}" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#0b1412">${escapeXml(tijd)}</text></g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img" aria-label="${escapeXml(visual.headline)}">
  <defs><linearGradient id="court" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b1412"/><stop offset="1" stop-color="#145f5a"/></linearGradient></defs>
  <rect width="1080" height="1080" fill="url(#court)"/>
  <path d="M70 120 H1010 M70 960 H1010 M150 70 V1010 M930 70 V1010" stroke="#ffffff" stroke-opacity="0.12" stroke-width="6"/>
  <circle cx="930" cy="145" r="86" fill="#ccff33"/><path d="M881 145c28-37 70-49 98-22M881 145c28 37 70 49 98 22" fill="none" stroke="#0b1412" stroke-width="8"/>
  <text x="90" y="170" font-family="Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="3" fill="#ccff33">${escapeXml(kortTekst(visual.eyebrow, 44))}</text>
  <text x="90" y="355" font-family="Arial, sans-serif" font-size="82" font-weight="800" fill="#ffffff">${escapeXml(kortTekst(visual.headline, 24))}</text>
  <text x="90" y="445" font-family="Arial, sans-serif" font-size="48" font-weight="600" fill="#d9f5ef">${escapeXml(kortTekst(visual.subline, 36))}</text>
  <text x="90" y="565" font-family="Arial, sans-serif" font-size="32" font-weight="700" letter-spacing="2" fill="#ffffff">BESCHIKBARE STARTTIJDEN</text>
  ${tijden}
  <text x="90" y="990" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Vrije<tspan fill="#ccff33">Baan</tspan></text>
  <text x="990" y="990" text-anchor="end" font-family="Arial, sans-serif" font-size="28" fill="#d9f5ef">${escapeXml(kortTekst(visual.cta, 42))}</text>
</svg>`;
}
