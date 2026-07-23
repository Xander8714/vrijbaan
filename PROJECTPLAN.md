# Projectplan: Padel Radar Haarlem + Opstelling-tool

**Datum:** 19 juli 2026
**Status:** Concept — klaar om te bouwen
**Auteur:** Xander (met onderzoek/uitwerking via Claude)

---

## 1. Het probleem

Padel groeit in Nederland harder dan het aanbod aan banen: 876.000 spelers in 2025, banen +25%, maar spelersaantal groeit sneller. Gevolg: wachtlijsten en volle clubs, vooral in dichtbevolkte regio's. Daarbovenop is het boekingslandschap versnipperd — spelers hebben 2-3 apps nodig (Playtomic voor commerciële clubs, KNLTB Meet & Play voor verenigingen) en beschikbaarheid is vaak alleen binnen een beperkt tijdvenster zichtbaar.

Daarnaast: teams die meedoen aan de KNLTB-competitie (7.400+ teams landelijk) moeten elke speelronde zelf hun koppel-opstelling bepalen — op basis van afnemende speelsterkte — zonder hulpmiddel om dit datagedreven te doen.

Twee losse problemen, één regionale app om mee te beginnen, met een landelijk uitbreidbaar tweede feature.

---

## 2. Regio-scope: Haarlem + 5 km

| Club | Plaats | Banen | Systeem | Status (2026) |
|------|--------|-------|---------|----------------|
| Racketclub Overhout | Haarlem | — | Playtomic (vermoedelijk) | Vol, wachtlijst dicht |
| TPV Pim Mulier | Haarlem | — | Meet & Play (vereniging) | Ledenstop senioren, wachtlijst heropend |
| WePadel Haarlem | Haarlem | 8 | Playtomic (vermoedelijk) | Grootste outdoor club van NL |
| Peakz Padel Haarlem | Haarlem | — | Playtomic (vermoedelijk) | — |
| PADEL25 Haarlem | Haarlem | — | Playtomic (vermoedelijk) | — |
| Schoten Tennis & Padel | Haarlem | — | Meet & Play (vereniging) | — |
| LTC Hofgeest | Velserbroek | 3 | Meet & Play (vereniging) | — |
| LTC Groeneveen | Santpoort-Noord (Driehuis+5km) | 10 | Meet & Play (vereniging) | — |

**Totaal: 8 locaties, ~47 banen.** De twee wachtlijst-clubs (Overhout, Pim Mulier) zijn je beste bron voor de eerste testgebruikers — die mensen zoeken nu al actief naar een plek.

*Let op: bovenstaande systeem-toewijzing (Playtomic vs. Meet & Play) is een aanname op basis van commercieel vs. vereniging. Eerste technische stap is dit per club te verifiëren.*

---

## 3. Feature 1 — Beschikbaarheid-notifier (MVP)

**Wat het doet:** monitort vrije padel-slots bij de 8 clubs en stuurt een melding (WhatsApp of push) zodra een slot vrijkomt dat past bij de voorkeur van de gebruiker (club, dag, tijdvak).

**Waarom dit werkt:** lost een acuut, actueel probleem op (schaarste + versnippering) voor een doelgroep die je nu al kunt aanspreken via je eigen padelnetwerk en de wachtlijsten.

**Technisch:**
- Twee databronnen: Playtomic (heeft een halfopen API die veel tools al gebruiken) en KNLTB Meet & Play (waarschijnlijk alleen te scrapen, geen publieke API — moet uitgezocht worden).
- Polling-service die periodiek (bv. elke 5-10 min) beschikbaarheid ophaalt en vergelijkt met vorige stand → bij nieuw vrij slot: trigger notificatie.
- Notificatiekanaal: begin met een simpele Telegram-bot of push (makkelijker te bouwen dan WhatsApp Business API, geen goedkeuringsproces nodig). WhatsApp kan later als upgrade.
- Gebruikersvoorkeuren: club(s), dagen, tijdvak, eventueel maximale prijs.

**Risico's:**
- Scrapen van Meet & Play kan tegen gebruiksvoorwaarden ingaan of instabiel zijn (site-structuur kan veranderen) — bouw dit met foutafhandeling en monitoring.
- Playtomic kan rate-limits hanteren — niet te vaak pollen.

**Monetisatie:** freemium (bv. 1 gratis club volgen, 3 meldingen per week) → €2,50-5/mnd voor onbeperkt volgen van meerdere clubs/tijden.

**Eerste gebruikers:** eigen club/vriendengroep in Haarlem + gerichte outreach naar de wachtlijsten van Overhout en Pim Mulier (bijv. via de clubs zelf vragen of je een berichtje mag plaatsen).

---

## 4. Feature 2 — Team-opstelling optimizer

**Context (KNLTB-regels):** teams stellen zelf koppels samen en zetten deze in volgorde van afnemende speelsterkte (schaal 1 = professioneel, 9 = beginner); het sterkste koppel speelt altijd wedstrijd 1. De aanvoerder kiest dus vrij *wie met wie* een koppel vormt — dat bepaalt indirect tegen welk tegenstander-koppel je uitkomt.

**Wat de tool doet:** aanvoerder voert de beschikbare spelers van die speeldag in (met hun speelsterkte/rating). De tool berekent welke koppel-combinaties de sterkste totale opstelling opleveren, en — als de tegenstander vooraf bekend is via MijnKNLTB — een verwachte winkans per koppel-matchup op basis van het ratingverschil (vergelijkbaar met een Elo-verwachtingsformule).

**Technisch:** dit is in de kern een toewijzingsprobleem (assignment problem) — geen zware AI nodig, wel een helder rekenmodel:
1. Bereken voor elk mogelijk koppel uit je roster een gecombineerde sterkte.
2. Rangschik mogelijke koppel-indelingen op basis van verwachte totaalscore tegen de bekende of geschatte tegenstander-opstelling.
3. Toon de aanvoerder de aanbevolen indeling + verwachte winkans per wedstrijd.

**Waarom dit apart waardevol is:** dit probleem is niet regio-gebonden — elk van de 7.400+ competitieteams in Nederland heeft het elk competitieweekend (voorjaar én najaar). Dit is het onderdeel met de meeste landelijke schaal.

**Volgorde:** eerst bouwen als extra feature binnen de Haarlem-app (test met je eigen team), later loskoppelen en landelijk aanbieden — los van beschikbaarheid-notifier, aan elke club/team in Nederland.

---

## 5. Tech stack (aansluitend op wat je al hebt)

- **Frontend/app:** Next.js + TypeScript + Tailwind (je hebt dit al opgezet)
- **Backend:** Next.js API routes of losse Node service voor de polling-job
- **Database:** Postgres (bv. via Supabase — snel te starten, gratis tier voldoende voor MVP)
- **Notificaties:** Telegram Bot API (MVP) → WhatsApp Business API (later)
- **Hosting:** Vercel (frontend) + een klein cron-/worker-proces voor de polling (Vercel Cron of een losse Railway/Render service)

---

## 6. Bouwvolgorde (voorstel)

1. **Week 1:** Playtomic + Meet & Play data-toegang uitzoeken per club (API vs. scrapen), datamodel opzetten.
2. **Week 2:** Polling-service + Telegram-notificaties voor 2-3 clubs (start met Overhout en Pim Mulier — hoogste urgentie).
3. **Week 3:** Uitbreiden naar alle 8 locaties, voorkeuren-instellingen voor gebruikers, eenvoudige landingpagina.
4. **Week 4:** Eerste testgroep (eigen netwerk + wachtlijst-mensen), feedback verwerken.
5. **Daarna:** Team-opstelling optimizer bouwen als tweede feature, testen met eigen team tijdens najaarscompetitie 2026.

---

## 7. Openstaande vragen om uit te zoeken

- Heeft Playtomic een (semi-)publieke API of moet dit ook gescraped worden?
- Zijn de verenigingsclubs (Pim Mulier, Schoten, Hofgeest, Groeneveen) allemaal via Meet & Play te benaderen, of hebben sommige een eigen boekingssysteem?
- Is er toestemming nodig van clubs om hun beschikbaarheid te monitoren/hergebruiken?
- Zijn spelers-speelsterktes en tegenstander-opstellingen via MijnKNLTB programmatisch op te vragen, of alleen handmatig in te voeren door de gebruiker?
