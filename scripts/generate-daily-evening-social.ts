/**
 * Maakt eenmaal per dag de 3-steden-avondpost uit de actuele cache. Het
 * concept blijft pending_approval en wordt via Telegram aangeboden; deze
 * worker publiceert zelf niets.
 */
import { loadEnvConfig } from "@next/env";
import {
  genereerConceptVoorbeeldAvond,
  genereerEnBewaarAvondConcept,
} from "../src/lib/socialMedia/repository";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  if (process.argv.includes("--dry-run")) {
    const concept = await genereerConceptVoorbeeldAvond();
    console.log(JSON.stringify({
      dryRun: true,
      subjectKey: concept.subjectKey,
      caption: concept.caption,
      visual: concept.visual,
    }, null, 2));
    return;
  }

  try {
    const id = await genereerEnBewaarAvondConcept();
    console.log(`Dagelijkse 3-stedenpost aangemaakt: ${id} (wacht op goedkeuring).`);
  } catch (fout) {
    const bericht = fout instanceof Error ? fout.message : String(fout);

    // Persistent timers kunnen na een herstart dezelfde kalenderdag opnieuw
    // lopen. Een bestaand dagconcept is dan een geldige, idempotente uitkomst.
    if (bericht === "Voor dit onderwerp is al eerder een concept gemaakt.") {
      console.log("Dagelijkse 3-stedenpost bestaat al; deze run is overgeslagen.");
      return;
    }

    throw fout;
  }
}

main().catch((fout) => {
  console.error("Dagelijkse 3-stedenpost kon niet worden gemaakt:", fout instanceof Error ? fout.message : String(fout));
  process.exitCode = 1;
});
