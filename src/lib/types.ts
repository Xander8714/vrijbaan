export type BoekingSysteem = "Playtomic" | "Meet & Play" | "Foys" | "Baanreserveren";
export type Club = { id: string; naam: string; plaats: string; banen: number; systeem: BoekingSysteem; status: string; boekingsUrl?: string; };
export type Player = { id: string; naam: string; speelsterkte: number; bondsnummer?: string; };
export type Pair = { spelers: [Player, Player]; gemSterkte: number; };
