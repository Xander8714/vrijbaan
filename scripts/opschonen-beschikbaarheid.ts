/**
 * Opschoning van `club_beschikbaarheid` — Xander (4 aug 2026): "zorg dat de
 * data geleegd wordt, dat is oude data waar de database niks meer aan
 * heeft" + "ook als niemand hem volgt, hou de database zo leeg mogelijk".
 *
 * Twee onafhankelijke opschoonregels, in één query:
 * 1. `datum` ligt al voor vandaag — niemand kan een baan van gisteren nog
 *    boeken, dus die rij heeft sowieso geen nut meer.
 * 2. `bijgewerkt_op` is ouder dan VERS_GRENS_MS — dezelfde grens als
 *    src/app/api/beschikbaarheid/route.ts gebruikt om te beslissen of een
 *    rij nog vertrouwd wordt. Ouder dan dat wordt een rij door de Radar al
 *    genegeerd (val terug op live scrapen), dus 'm laten staan heeft geen
 *    functie meer — dit is typisch een club die niemand (meer) volgt en die
 *    scripts/poll-availability.ts daarom niet meer ververst.
 *
 * Draait via een systemd-timer op de VPS, net als vrijebaan-poll.timer —
 * elke 15 minuten, zodat "niet meer gevolgd" niet tot 24 uur kan blijven
 * liggen voor de eerstvolgende opschoning.
 *
 * Handmatig draaien: npx tsx scripts/opschonen-beschikbaarheid.ts
 */
import { supabaseAdmin } from "../src/lib/supabase/admin";

// Zelfde grens als VERS_GRENS_MS in src/app/api/beschikbaarheid/route.ts —
// een rij ouder dan dit wordt daar al genegeerd, dus mag hier ook weg.
const VERS_GRENS_MINUTEN = 6;

async function main(): Promise<void> {
  const vandaag = new Date().toISOString().slice(0, 10);
  const versGrens = new Date(Date.now() - VERS_GRENS_MINUTEN * 60 * 1000).toISOString();
  const supabase = supabaseAdmin();

  const { error, count } = await supabase
    .from("club_beschikbaarheid")
    .delete({ count: "exact" })
    .or(`datum.lt.${vandaag},bijgewerkt_op.lt.${versGrens}`);

  if (error) {
    console.error("[opschonen-beschikbaarheid] mislukt:", error.message);
    process.exit(1);
  }

  console.log(
    `[opschonen-beschikbaarheid] ${count ?? 0} rij(en) verwijderd (verlopen datum, of niet ververst sinds ${versGrens}).`
  );
}

main().catch((fout) => {
  console.error("[opschonen-beschikbaarheid] onverwachte fout:", fout);
  process.exit(1);
});
