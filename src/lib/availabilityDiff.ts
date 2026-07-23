import crypto from "crypto";

export type Slot = { startTime: string };

/** Volgorde-onafhankelijke hash, zodat een andere renderingsvolgorde niet als wijziging telt. */
export function hashSlots(slots: Slot[]): string {
  const genormaliseerd = [...slots]
    .map((s) => s.startTime)
    .sort()
    .join(",");
  return crypto.createHash("sha256").update(genormaliseerd).digest("hex");
}

/**
 * Sloten die in `nieuwe` zitten maar niet in `vorige`.
 * `vorige === null` betekent: nog geen eerdere meting (eerste poll voor deze
 * club/dag) — dan is er geen "nieuw" slot, alleen een startpunt. Zonder deze
 * check zou de allereerste poll de hele dag-agenda als "nieuw vrijgekomen"
 * melden, wat een valse-positieve stortvloed aan notificaties geeft.
 */
export function nieuweSlotenSinds(vorige: Slot[] | null, nieuwe: Slot[]): Slot[] {
  if (vorige === null) return [];
  const vorigeTijden = new Set(vorige.map((s) => s.startTime));
  return nieuwe.filter((s) => !vorigeTijden.has(s.startTime));
}
