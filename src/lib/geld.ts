/** Bedrag in euro's zoals de app het overal toont, bv. 24 -> "€ 24,00". */
export function formatEuro(bedrag: number): string {
  return `€ ${bedrag.toFixed(2).replace(".", ",")}`;
}
