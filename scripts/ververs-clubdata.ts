/**
 * Maandelijkse ververs-job voor de drie automatisch gegenereerde clubdata-
 * bestanden (Foys/Peakz, Meet & Play, Playtomic) — Xander (4 aug 2026):
 * "sommige hebben nieuwe banen of halen banen eruit, die updates moeten we
 * wel hebben". Draait via een systemd-timer op de VPS, net als
 * vrijebaan-poll.timer (zie PROJECTPLAN.md §11) — eerste zondag van de
 * maand, 03:00, zodat niemand er iets van merkt.
 *
 * Elke bron heeft een ander risicoprofiel:
 * - Foys: directe API, geen scraping — altijd veilig te automatiseren.
 * - Meet & Play: één paginabezoek voor de hele directory — laag risico.
 * - Playtomic: crawlt honderden clubpagina's na elkaar en heeft al eerder
 *   een tijdelijke 403 opgeleverd bij herhaald draaien (zie
 *   discover-playtomic-clubs.ts). Xander koos expliciet "automatiseer
 *   toch, met dat risico" (4 aug 2026) — maar een afgebroken/geblokkeerde
 *   crawl mag NOOIT de bestaande, complete lijst overschrijven met een
 *   half resultaat (elke discover-run herbouwt zijn bestand helemaal
 *   opnieuw vanaf twee vaste startpunten, geen merge met wat er al stond).
 *   Vandaar VEILIGHEIDSGRENS hieronder: valt een bron te ver terug t.o.v.
 *   het huidige aantal, dan wordt dat bestand teruggedraaid i.p.v. gecommit.
 *
 * Bij een geslaagde ververs: commit + push + dezelfde build/restart als een
 * gewone deploy (scripts/deploy-vps.sh), plus een Telegram-samenvatting naar
 * TELEGRAM_CHAT_ID. Bij een teruggedraaide/verdachte run: ook een bericht,
 * met wat er misging — nooit stilzwijgend.
 *
 * Handmatig draaien: npx tsx scripts/ververs-clubdata.ts
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { stuurTelegramBericht } from "../src/lib/telegram";

type Bron = { naam: string; commando: string; pad: string };

const VEILIGHEIDSGRENS = 0.85; // onder dit aandeel van het oude aantal: verdacht, terugdraaien

const BRONNEN: Bron[] = [
  { naam: "Foys/Peakz", commando: "npx tsx scripts/import-foys-clubs.ts", pad: "src/lib/clubs.foys.ts" },
  { naam: "Meet & Play", commando: "npx tsx scripts/discover-meetandplay-clubs.ts", pad: "src/lib/clubs.meetandplay.ts" },
  // Ruime marge boven het huidige aantal (95, 4 aug 2026) — de crawl begint
  // elke keer opnieuw vanaf twee vaste startpunten en bouwt het netwerk
  // weer helemaal op, dus moet ruimte hebben om te groeien.
  { naam: "Playtomic", commando: "npx tsx scripts/discover-playtomic-clubs.ts 200", pad: "src/lib/clubs.playtomic.ts" },
];

const CLUBDATA_PADEN = BRONNEN.map((b) => b.pad).join(" ");

function telClubs(pad: string): number {
  try {
    return (readFileSync(pad, "utf8").match(/\{ id: /g) ?? []).length;
  } catch {
    return 0;
  }
}

function run(commando: string): { ok: boolean; output: string } {
  try {
    const output = execSync(commando, { encoding: "utf8", stdio: "pipe", maxBuffer: 20 * 1024 * 1024 });
    return { ok: true, output };
  } catch (fout) {
    const e = fout as { stdout?: string; stderr?: string; message: string };
    return { ok: false, output: `${e.stdout ?? ""}\n${e.stderr ?? e.message}` };
  }
}

async function meldAdmin(tekst: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  console.log(`\n[ververs-clubdata] ${tekst}`);
  if (chatId) await stuurTelegramBericht(chatId, tekst);
}

async function main(): Promise<void> {
  const wijzigingen: string[] = [];
  const problemen: string[] = [];

  for (const bron of BRONNEN) {
    const voor = telClubs(bron.pad);
    console.log(`\n=== ${bron.naam} (nu ${voor} clubs) ===`);
    const resultaat = run(bron.commando);
    console.log(resultaat.output.slice(-3000)); // volledige crawl-logs kunnen lang zijn

    if (!resultaat.ok) {
      run(`git checkout -- ${bron.pad}`);
      problemen.push(`${bron.naam}: script gaf een fout, niets gewijzigd.`);
      continue;
    }

    const na = telClubs(bron.pad);
    if (voor > 0 && na < voor * VEILIGHEIDSGRENS) {
      run(`git checkout -- ${bron.pad}`);
      problemen.push(
        `${bron.naam}: viel van ${voor} naar ${na} clubs (>${Math.round((1 - VEILIGHEIDSGRENS) * 100)}% minder) — teruggedraaid, waarschijnlijk geblokkeerd/afgebroken.`
      );
      continue;
    }

    if (na !== voor) wijzigingen.push(`${bron.naam}: ${voor} → ${na} clubs`);
  }

  const gewijzigdeBestanden = run(`git status --porcelain -- ${CLUBDATA_PADEN}`).output.trim();

  if (!gewijzigdeBestanden) {
    if (problemen.length > 0) await meldAdmin(`⚠️ Clubdata-ververs — geen wijzigingen toegepast:\n${problemen.join("\n")}`);
    console.log("\nGeen wijzigingen — klaar.");
    return;
  }

  console.log("\n=== Controle vóór commit (tsc + tests) ===");
  const controle = run("npx tsc --noEmit && npm test");
  if (!controle.ok) {
    run(`git checkout -- ${CLUBDATA_PADEN}`);
    await meldAdmin(`⚠️ Clubdata-ververs afgebroken: nieuwe data faalde tsc/tests, teruggedraaid.\n${controle.output.slice(-500)}`);
    return;
  }

  const commitBoodschap = `Automatische clubdata-ververs (${new Date().toISOString().slice(0, 10)})\n\n${
    wijzigingen.join("\n") || "Kleine wijzigingen zonder aantalverschil (bv. gewijzigde banen/adres)."
  }`;
  run(`git add ${CLUBDATA_PADEN}`);
  run(`git commit -m ${JSON.stringify(commitBoodschap)}`);
  const pushResultaat = run("git push origin master");
  if (!pushResultaat.ok) {
    await meldAdmin(`⚠️ Clubdata gecommit, maar pushen naar GitHub mislukte (deploy key ontbreekt/verlopen?):\n${pushResultaat.output.slice(-500)}`);
    return;
  }

  console.log("\n=== Herbouwen en herstarten ===");
  const deploy = run("bash scripts/deploy-vps.sh");
  console.log(deploy.output.slice(-2000));

  const eindmelding = [
    deploy.ok ? "✅ Clubdata ververst en live:" : "⚠️ Clubdata gecommit/gepusht, maar de deploy zelf faalde:",
    ...wijzigingen.map((w) => `• ${w}`),
    ...(problemen.length > 0 ? ["", "Let op:", ...problemen.map((p) => `• ${p}`)] : []),
    ...(!deploy.ok ? ["", deploy.output.slice(-500)] : []),
  ].join("\n");
  await meldAdmin(eindmelding);
}

main().catch(async (fout) => {
  console.error("ververs-clubdata mislukt:", fout);
  await meldAdmin(`⚠️ ververs-clubdata.ts crashte onverwacht: ${fout instanceof Error ? fout.message : String(fout)}`);
  process.exit(1);
});
