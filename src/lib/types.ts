export type BoekingSysteem = "Playtomic" | "Meet & Play";
export type Club = { id: string; naam: string; plaats: string; banen: number; systeem: BoekingSysteem; status: string; };
export type Player = { id: string; naam: string; speelsterkte: number; };
export type Pair = { spelers: [Player, Player]; gemSterkte: number; };
