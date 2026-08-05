/**
 * Staat alleen paden binnen VrijeBaan toe. Daarmee kunnen login- en
 * magiclinkflows de oorspronkelijke bestemming bewaren zonder open redirect.
 */
export function veiligInternPad(pad: string | null, terugval = "/radar"): string {
  if (!pad || !pad.startsWith("/") || pad.startsWith("//")) return terugval;
  return pad;
}
