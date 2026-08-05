/** Plant posts 2–5 van de launchcampagne, idempotent en altijd in goedkeuringsmodus. */
import { loadEnvConfig } from "@next/env";
import { planLaunchCampagne } from "../src/lib/socialMedia/repository";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const resultaat = await planLaunchCampagne();
  console.log(`Launchcampagne gepland: ${resultaat.aangemaakt} nieuw, ${resultaat.overgeslagen} al aanwezig.`);
}

if (require.main === module) {
  main().catch((fout) => {
    console.error("Launchcampagne plannen mislukt:", fout);
    process.exit(1);
  });
}
