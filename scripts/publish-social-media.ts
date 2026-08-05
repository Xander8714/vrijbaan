/**
 * Publiceert goedgekeurde of verstreken geplande socialmediaposts.
 *
 * De systemd-timer start dit script eenmaal per minuut; elke run verwerkt
 * maximaal vijf posts en stopt daarna. Met --check wordt alleen de zakelijke
 * Meta-koppeling gecontroleerd en geen databasepost geclaimd.
 */
import { loadEnvConfig } from "@next/env";
import { maakMetaClient } from "../src/lib/socialMedia/meta";
import {
  leesMetaConfiguratieUitOmgeving,
  publiceerEenVerschuldigdePost,
} from "../src/lib/socialMedia/publisher";

loadEnvConfig(process.cwd());

const MAX_POSTS_PER_RUN = 5;

async function main(): Promise<void> {
  if (process.argv.includes("--check")) {
    const koppeling = await maakMetaClient(leesMetaConfiguratieUitOmgeving()).controleerKoppeling();
    console.log(`Meta-koppeling actief: Facebook ${koppeling.pageName} (${koppeling.pageId}), Instagram ${koppeling.instagramAccountId}.`);
    return;
  }

  let verwerkt = 0;
  while (verwerkt < MAX_POSTS_PER_RUN) {
    const resultaat = await publiceerEenVerschuldigdePost();
    if (resultaat.status === "idle") break;
    verwerkt += 1;
    if (resultaat.status === "published") {
      console.log(`Socialmediapost ${resultaat.postId} gepubliceerd op ${Object.keys(resultaat.externalPostIds).join(" en ")}.`);
      continue;
    }
    console.error(`Socialmediapost ${resultaat.postId} mislukt: ${resultaat.error}`);
    if (resultaat.retryAt) console.error(`Nieuwe poging gepland voor ${resultaat.retryAt}.`);
    process.exitCode = 1;
    break;
  }
  if (verwerkt === 0) console.log("Geen socialmediaposts verschuldigd.");
}

main().catch((fout) => {
  console.error("Socialmediapublicatie kon niet starten:", fout instanceof Error ? fout.message : String(fout));
  process.exitCode = 1;
});
