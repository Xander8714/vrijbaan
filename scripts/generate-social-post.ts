/**
 * Maakt maximaal één socialmediaconcept uit de bestaande beschikbaarheidscache.
 * Publiceert nooit: de rij krijgt altijd status pending_approval.
 */
import { loadEnvConfig } from "@next/env";
import { genereerConceptVoorbeeld, genereerEnBewaarConcept } from "../src/lib/socialMedia/repository";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  if (process.argv.includes("--dry-run")) {
    const concept = await genereerConceptVoorbeeld();
    console.log(JSON.stringify({
      dryRun: true,
      subjectKey: concept.subjectKey,
      city: concept.city,
      clubId: concept.clubId,
      sourceUpdatedAt: concept.sourceUpdatedAt,
      caption: concept.caption,
      visual: concept.visual,
    }, null, 2));
    return;
  }
  const id = await genereerEnBewaarConcept();
  console.log(`Socialmediaconcept aangemaakt: ${id} (wacht op goedkeuring).`);
}

if (require.main === module) {
  main().catch((fout) => {
    console.error("Socialmediaconcept genereren mislukt:", fout);
    process.exit(1);
  });
}
