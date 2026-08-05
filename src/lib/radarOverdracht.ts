export type RadarSlot = { tijd: string; prijs: string | null };
export type RadarMetingRij = { clubId: string; sloten: RadarSlot[]; fout?: string };
export type RadarOverdrachtData = {
  datum: string;
  beschikbaarheid: RadarMetingRij[];
  opgehaaldOp: string;
};

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CLUBS = 20;
const MAX_SLOTS_PER_CLUB = 100;

/** Valideert de tijdelijke JSON voordat een API-route hem aan de browser geeft. */
export function isRadarOverdrachtData(value: unknown): value is RadarOverdrachtData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<RadarOverdrachtData>;
  if (typeof data.datum !== "string" || !ISO_DATUM.test(data.datum)) return false;
  if (typeof data.opgehaaldOp !== "string" || !Number.isFinite(Date.parse(data.opgehaaldOp))) return false;
  if (!Array.isArray(data.beschikbaarheid) || data.beschikbaarheid.length > MAX_CLUBS) return false;

  return data.beschikbaarheid.every((rij) => {
    if (!rij || typeof rij !== "object") return false;
    const meting = rij as Partial<RadarMetingRij>;
    if (typeof meting.clubId !== "string" || meting.clubId.length === 0) return false;
    if (meting.fout !== undefined && typeof meting.fout !== "string") return false;
    if (!Array.isArray(meting.sloten) || meting.sloten.length > MAX_SLOTS_PER_CLUB) return false;
    return meting.sloten.every(
      (slot) =>
        Boolean(slot) &&
        typeof slot.tijd === "string" &&
        (slot.prijs === null || typeof slot.prijs === "string")
    );
  });
}

/** Zet een overdracht om naar dezelfde Map-vorm die de Radar live gebruikt. */
export function overdrachtNaarMetingen(data: RadarOverdrachtData) {
  return new Map(
    data.beschikbaarheid.map((rij) => [
      `${rij.clubId}|${data.datum}`,
      { sloten: rij.sloten, fout: rij.fout },
    ])
  );
}
