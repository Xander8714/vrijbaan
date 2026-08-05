import { komendeDagen } from "./tijd";

export const MAX_CLUBS_NORMAAL = 20;
export const MAX_CLUBS_VER_VOORUIT = 4;
const CACHE_VENSTER_DAGEN = 3;

type ClubMetAfstand = {
  id: string;
  afstandKm: number | null;
};

/**
 * Maakt de Radar-selectie adaptief aan zowel datum als clubdichtheid.
 *
 * Vandaag t/m overmorgen is er normaal gesproken cache en kunnen we maximaal
 * twintig clubs tonen. Verder vooruit beperken we het live werk tot vier
 * clubs, maar houden we de volledige gekozen straal aan. In een dunbevolkt
 * gebied vallen er daardoor niet onnodig clubs weg door een vaste 5-km-grens.
 *
 * Alleen clubs binnen het actieve zoekgebied doen mee. Een gevolgde club in
 * een andere regio wordt dus niet live opgehaald en neemt geen plek in van de
 * vier clubs rond de locatie waar de gebruiker nu bewust zoekt.
 */
export function maakRadarSelectie<T extends ClubMetAfstand>(
  clubs: T[],
  straalKm: number,
  gevolgd: ReadonlySet<string>,
  datum: string,
  vanaf: Date = new Date()
) {
  const verVooruit = !komendeDagen(CACHE_VENSTER_DAGEN, vanaf).includes(datum);
  const maximum = verVooruit ? MAX_CLUBS_VER_VOORUIT : MAX_CLUBS_NORMAAL;
  const clubsBinnenStraal = clubs
    .filter((club) => club.afstandKm === null || club.afstandKm <= straalKm)
    .sort((a, b) => (a.afstandKm ?? 0) - (b.afstandKm ?? 0));

  const gevolgdeBinnenStraal = clubsBinnenStraal.filter((club) => gevolgd.has(club.id));
  const overigeBinnenStraal = clubsBinnenStraal.filter((club) => !gevolgd.has(club.id));
  const clubsOmTeTonen = [...gevolgdeBinnenStraal, ...overigeBinnenStraal].slice(0, maximum);
  const begrensd = clubsBinnenStraal.length > maximum;
  const effectieveStraalKm = begrensd
    ? Math.ceil(Math.max(0, ...clubsOmTeTonen.map((club) => club.afstandKm ?? 0)))
    : straalKm;

  return {
    clubsBinnenStraal,
    clubsOmTeTonen,
    maximum,
    begrensd,
    verVooruit,
    effectieveStraalKm,
  };
}
