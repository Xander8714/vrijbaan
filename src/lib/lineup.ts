import { Pair, Player } from "./types";

export function alleKoppelIndelingen(spelers: Player[]): Player[][][] {
  if (spelers.length === 0) return [[]];
  if (spelers.length % 2 !== 0) throw new Error("Aantal spelers moet even zijn om koppels te vormen.");
  const [eerste, ...rest] = spelers;
  const resultaten: Player[][][] = [];
  for (let i = 0; i < rest.length; i++) {
    const partner = rest[i];
    const overgebleven = rest.filter((_, idx) => idx !== i);
    const subIndelingen = alleKoppelIndelingen(overgebleven);
    for (const sub of subIndelingen) resultaten.push([[eerste, partner], ...sub]);
  }
  return resultaten;
}

export function naarPairs(koppels: Player[][]): Pair[] {
  return koppels.map((k) => ({ spelers: [k[0], k[1]] as [Player, Player], gemSterkte: (k[0].speelsterkte + k[1].speelsterkte) / 2 }));
}

export function sorteerOpSterkte(pairs: Pair[]): Pair[] {
  return [...pairs].sort((a, b) => a.gemSterkte - b.gemSterkte);
}

export function winkans(eigenGemSterkte: number, tegenGemSterkte: number, k = 3): number {
  const verschil = tegenGemSterkte - eigenGemSterkte;
  return 1 / (1 + Math.pow(10, -verschil / k));
}

export type OpstellingResultaat = {
  pairs: Pair[];
  verwachtWinpercentage: number;
  perWedstrijd: { eigen: Pair; tegen?: Pair; winkans?: number }[];
};

export function besteOpstelling(eigenSpelers: Player[], tegenstanderSpelers?: Player[]): OpstellingResultaat {
  const indelingen = alleKoppelIndelingen(eigenSpelers);
  let tegenPairs: Pair[] | undefined;
  if (tegenstanderSpelers && tegenstanderSpelers.length > 0) {
    const tegenIndelingen = alleKoppelIndelingen(tegenstanderSpelers);
    tegenPairs = sorteerOpSterkte(naarPairs(tegenIndelingen[0]));
  }
  let beste: OpstellingResultaat | null = null;
  for (const indeling of indelingen) {
    const pairs = sorteerOpSterkte(naarPairs(indeling));
    if (tegenPairs) {
      const perWedstrijd = pairs.map((eigen, i) => {
        const tegen = tegenPairs![i];
        const kans = tegen ? winkans(eigen.gemSterkte, tegen.gemSterkte) : undefined;
        return { eigen, tegen, winkans: kans };
      });
      const totaal = perWedstrijd.reduce((som, w) => som + (w.winkans ?? 0), 0);
      const gemiddeld = totaal / perWedstrijd.length;
      if (!beste || gemiddeld > beste.verwachtWinpercentage) beste = { pairs, verwachtWinpercentage: gemiddeld, perWedstrijd };
    } else {
      const sterktes = pairs.map((p) => p.gemSterkte);
      const spreiding = Math.max(...sterktes) - Math.min(...sterktes);
      const score = -spreiding;
      if (!beste || score > beste.verwachtWinpercentage) beste = { pairs, verwachtWinpercentage: score, perWedstrijd: pairs.map((eigen) => ({ eigen })) };
    }
  }
  return beste!;
}
