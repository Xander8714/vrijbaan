import type { AvailabilityVisual, EditorialSlide, SocialVisual } from "./types";

const VERBODEN_SPELLING_IN_VISUAL = /\bpadelen\b/i;

/**
 * VrijeBaan gebruikt in Nederlandse lopende tekst consequent "padellen".
 * Blokkeer de veelgemaakte spelfout voordat een afbeelding wordt opgeslagen
 * of gerenderd, zodat die niet opnieuw in een JPEG kan belanden.
 */
export function controleerSocialVisualSpelling(visual: SocialVisual): void {
  if (VERBODEN_SPELLING_IN_VISUAL.test(JSON.stringify(visual))) {
    throw new Error('Socialvisual bevat de spelfout "padelen"; gebruik "padellen".');
  }
}

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

function renderEditorialSlide(slide: EditorialSlide, index: number, totaal: number): string {
  const grootsteRegel = Math.max(...slide.lines.map((regel) => regel.text.length));
  const fontSize = grootsteRegel > 22 ? 66 : grootsteRegel > 16 ? 76 : 88;
  const startY = slide.lines.length >= 3 ? 335 : 405;
  const regels = slide.lines.map((regel, regelIndex) =>
    `<text x="82" y="${startY + regelIndex * (fontSize + 18)}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="${regel.accent ? "#c7ff22" : "#f8fafc"}">${escapeXml(kortTekst(regel.text, 32))}</text>`
  ).join("");
  const bodyY = startY + slide.lines.length * (fontSize + 18) + 42;
  const chips = (slide.chips ?? []).slice(0, 4).map((chip, chipIndex) => {
    const x = 82 + (chipIndex % 2) * 300;
    const y = 760 + Math.floor(chipIndex / 2) * 82;
    return `<g><rect x="${x}" y="${y}" width="270" height="58" rx="29" fill="#102b27" stroke="#24574f"/><text x="${x + 135}" y="${y + 39}" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#e2e8f0">${escapeXml(kortTekst(chip, 20))}</text></g>`;
  }).join("");
  const motif = slide.motif === "telegram"
    ? `<rect x="690" y="655" width="300" height="180" rx="28" fill="#102b27" stroke="#24574f" stroke-width="3"/><circle cx="745" cy="710" r="24" fill="#c7ff22"/><path d="M733 710l9 9 17-20" fill="none" stroke="#06100e" stroke-width="6"/><text x="785" y="704" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#f8fafc">Nieuwe padelplek</text><text x="785" y="740" font-family="Arial, sans-serif" font-size="20" fill="#94a3b8">Boek direct →</text>`
    : slide.motif === "radar"
      ? `<circle cx="900" cy="710" r="118" fill="none" stroke="#c7ff22" stroke-opacity=".24" stroke-width="3"/><circle cx="900" cy="710" r="70" fill="none" stroke="#c7ff22" stroke-opacity=".4" stroke-width="3"/><circle cx="900" cy="710" r="16" fill="#c7ff22"/>`
      : slide.motif === "builder"
        ? `<path d="M770 710h210M770 760h150M770 810h180" stroke="#c7ff22" stroke-width="12" stroke-linecap="round" opacity=".55"/>`
        : `<circle cx="900" cy="735" r="128" fill="#c7ff22"/><text x="900" y="765" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="900" fill="#06100e">€0</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img" aria-label="${escapeXml(slide.lines.map((regel) => regel.text).join(" "))}">
  <rect width="1080" height="1080" fill="#06100e"/>
  <path d="M42 102 H1038 V954 H42 Z M540 102V954 M42 528H1038" fill="none" stroke="#0b3731" stroke-width="4"/><path d="M540 102V954" stroke="#0b3731" stroke-dasharray="12 20" stroke-width="3"/>
  <text x="82" y="160" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#c7ff22">VrijeBaan</text>
  <text x="82" y="245" font-family="Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="4" fill="#89a59f">${escapeXml(kortTekst(slide.eyebrow, 42))}</text>
  ${regels}
  ${slide.body ? `<text x="82" y="${Math.min(bodyY, 700)}" font-family="Arial, sans-serif" font-size="30" fill="#cbd5e1">${escapeXml(kortTekst(slide.body, 68))}</text>` : ""}
  ${chips}${motif}
  ${slide.cta ? `<rect x="82" y="902" width="520" height="78" rx="39" fill="#c7ff22"/><text x="342" y="952" text-anchor="middle" font-family="Arial, sans-serif" font-size="27" font-weight="800" fill="#06100e">${escapeXml(kortTekst(slide.cta, 38))}</text>` : ""}
  <text x="998" y="966" text-anchor="end" font-family="Arial, sans-serif" font-size="24" fill="#63847d">${index + 1}/${totaal}</text>
</svg>`;
}

export function aantalSocialVisualSlides(visual: SocialVisual): number {
  return visual.template === "availability-v1" ? 1 : visual.slides.length;
}

export function isSocialStoryVisual(visual: SocialVisual): boolean {
  return visual.template === "availability-story-v1";
}

export function renderSocialVisualSvg(visual: SocialVisual, slideIndex = 0): string {
  controleerSocialVisualSpelling(visual);
  if (visual.template === "editorial-carousel-v1") {
    const begrensd = Math.max(0, Math.min(slideIndex, visual.slides.length - 1));
    return renderEditorialSlide(visual.slides[begrensd], begrensd, visual.slides.length);
  }
  if (visual.template === "availability-carousel-v1") {
    const begrensd = Math.max(0, Math.min(slideIndex, visual.slides.length - 1));
    return renderAvailabilitySlide(visual.slides[begrensd], begrensd, visual.slides.length);
  }
  if (visual.template === "availability-story-v1") {
    const begrensd = Math.max(0, Math.min(slideIndex, visual.slides.length - 1));
    return renderAvailabilityStorySlide(visual.slides[begrensd], begrensd, visual.slides.length);
  }
  return renderAvailabilitySlide(visual, 0, 1);
}

function renderAvailabilityStorySlide(visual: AvailabilityVisual, slideIndex: number, totaal: number): string {
  const tijden = visual.times
    .slice(0, 5)
    .map((tijd, index) => {
      const x = 110 + (index % 2) * 445;
      const y = 900 + Math.floor(index / 2) * 150;
      return `<g><rect x="${x}" y="${y}" width="390" height="104" rx="52" fill="#ccff33"/><text x="${x + 195}" y="${y + 70}" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="#0b1412">${escapeXml(tijd)}</text></g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" role="img" aria-label="${escapeXml(visual.headline)}">
  <defs><linearGradient id="story-court" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b1412"/><stop offset="1" stop-color="#145f5a"/></linearGradient></defs>
  <rect width="1080" height="1920" fill="url(#story-court)"/>
  <path d="M70 120 H1010 M70 1800 H1010 M150 70 V1850 M930 70 V1850 M150 960 H930" stroke="#ffffff" stroke-opacity="0.12" stroke-width="6"/>
  <circle cx="900" cy="220" r="92" fill="#ccff33"/><path d="M848 220c30-40 75-53 105-24M848 220c30 40 75 53 105 24" fill="none" stroke="#0b1412" stroke-width="9"/>
  <text x="90" y="210" font-family="Arial, sans-serif" font-size="31" font-weight="800" letter-spacing="3" fill="#ccff33">${escapeXml(kortTekst(visual.eyebrow, 44))}</text>
  <text x="90" y="500" font-family="Arial, sans-serif" font-size="92" font-weight="900" fill="#ffffff">${escapeXml(kortTekst(visual.headline, 21))}</text>
  <text x="90" y="610" font-family="Arial, sans-serif" font-size="51" font-weight="650" fill="#d9f5ef">${escapeXml(kortTekst(visual.subline, 34))}</text>
  <text x="90" y="800" font-family="Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="2" fill="#ffffff">BESCHIKBARE STARTTIJDEN</text>
  ${tijden}
  <rect x="90" y="1510" width="900" height="118" rx="59" fill="#ccff33"/>
  <text x="540" y="1583" text-anchor="middle" font-family="Arial, sans-serif" font-size="35" font-weight="900" fill="#0b1412">${escapeXml(kortTekst(visual.cta, 42))}</text>
  <text x="90" y="1780" font-family="Arial, sans-serif" font-size="42" font-weight="800" fill="#ffffff">Vrije<tspan fill="#ccff33">Baan</tspan></text>
  <text x="990" y="1780" text-anchor="end" font-family="Arial, sans-serif" font-size="28" fill="#89a59f">${slideIndex + 1}/${totaal} • 24 UUR ACTUEEL</text>
</svg>`;
}

function renderAvailabilitySlide(visual: AvailabilityVisual, slideIndex: number, totaal: number): string {
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
  ${totaal > 1 ? `<text x="990" y="930" text-anchor="end" font-family="Arial, sans-serif" font-size="24" fill="#63847d">${slideIndex + 1}/${totaal}</text>` : ""}
</svg>`;
}
