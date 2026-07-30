/**
 * Validatie/normalisatie van Nederlandse mobiele nummers. Optioneel veld —
 * dit bestand bepaalt alleen of een IGEVULD nummer geldig is, niet of het
 * veld verplicht is (dat is aan de aanroeper).
 *
 * Waarom alleen mobiel: het telefoonnummer is bedoeld voor toekomstige
 * notificaties (SMS/WhatsApp, zie PROJECTPLAN.md's notificatiekanalen-epic)
 * — een vast nummer kan geen sms/WhatsApp ontvangen, dus dat accepteren zou
 * een nummer opslaan dat we nooit kunnen gebruiken.
 *
 * Geaccepteerde invoer (spaties/streepjes worden genegeerd):
 *   06-12345678, 0612345678, +31 6 12345678, 0031612345678
 * Opgeslagen/genormaliseerd formaat: +316XXXXXXXX (E.164-achtig).
 */

const NL_MOBIEL_RE = /^\+316\d{8}$/;

/** Haalt spaties, streepjes en haakjes weg zodat alleen cijfers en een eventuele + overblijven. */
function opschonen(ruw: string): string {
  return ruw.replace(/[\s\-().]/g, "");
}

/**
 * Zet een los ingetypt nummer om naar het genormaliseerde +316XXXXXXXX-
 * formaat. Geeft null als de invoer geen geldig NL-mobiel nummer is —
 * de aanroeper toont dan een foutmelding i.p.v. iets ongeldigs op te slaan.
 */
export function normaliseerMobielNummer(ruw: string): string | null {
  const schoon = opschonen(ruw.trim());
  if (schoon === "") return null;

  let genormaliseerd: string;
  if (schoon.startsWith("+31")) genormaliseerd = schoon;
  else if (schoon.startsWith("0031")) genormaliseerd = `+31${schoon.slice(4)}`;
  else if (schoon.startsWith("06")) genormaliseerd = `+31${schoon.slice(1)}`;
  else if (schoon.startsWith("6") && schoon.length === 9) genormaliseerd = `+31${schoon}`;
  else return null;

  return NL_MOBIEL_RE.test(genormaliseerd) ? genormaliseerd : null;
}

export function isGeldigMobielNummer(ruw: string): boolean {
  return normaliseerMobielNummer(ruw) !== null;
}

/** Voor weergave: +316XXXXXXXX -> "06 XXXX XXXX". Geeft de ruwe invoer terug als die niet genormaliseerd is. */
export function toonMobielNummer(genormaliseerd: string): string {
  const m = NL_MOBIEL_RE.exec(genormaliseerd);
  if (!m) return genormaliseerd;
  const lokaal = "0" + genormaliseerd.slice(3); // +316XXXXXXXX -> 06XXXXXXXX
  return `${lokaal.slice(0, 2)} ${lokaal.slice(2, 6)} ${lokaal.slice(6)}`;
}
