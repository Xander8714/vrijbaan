import type { EditorialVisual } from "./types";

export type LaunchCampagnePost = {
  subjectKey: string;
  subjectId: string;
  contentType: "tip" | "spotlight";
  caption: string;
  hashtags: string[];
  scheduledFor: string;
  visual: EditorialVisual;
  format: string;
  strategyPosition: number;
};

const basisHashtags = ["padel", "vrijebaan", "padelhaarlem"];

export const LAUNCH_CAMPAGNE: LaunchCampagnePost[] = [
  {
    strategyPosition: 2,
    subjectKey: "campaign:launch:2:radar-demo",
    subjectId: "radar-demo",
    contentType: "tip",
    format: "Carrousel — geautomatiseerde Radar-demo",
    scheduledFor: "2026-08-07T19:00:00+02:00",
    hashtags: [...basisHashtags, "padelradar"],
    caption:
      "Zo werkt de Radar: kies je locatie, stel je straal in en tik op Zoek nu. Je ziet meteen welke clubs vrije banen hebben. Test ’m nu gratis na registratie via devrijebaan.nl/radar 🎾\n\n#padel #vrijebaan #padelhaarlem #padelradar",
    visual: {
      template: "editorial-carousel-v1",
      accent: "court-ball",
      slides: [
        { eyebrow: "VRIJEBAAN • RADAR", lines: [{ text: "Zo werkt" }, { text: "de Radar.", accent: true }], body: "Van locatie naar vrije baan in drie stappen.", motif: "radar" },
        { eyebrow: "STAP VOOR STAP", lines: [{ text: "1. Kies locatie" }, { text: "2. Stel straal in" }, { text: "3. Zoek nu", accent: true }], chips: ["Playtomic", "Meet & Play", "Foys / Peakz"], motif: "radar" },
        { eyebrow: "ÉÉN OVERZICHT", lines: [{ text: "Zie vrije banen." }, { text: "Meteen.", accent: true }], body: "Geen vijf apps of tabbladen meer.", cta: "devrijebaan.nl/radar", motif: "radar" },
      ],
    },
  },
  {
    strategyPosition: 3,
    subjectKey: "campaign:launch:3:telegram-bot",
    subjectId: "telegram-bot",
    contentType: "tip",
    format: "Statische notificatievisual",
    scheduledFor: "2026-08-10T19:00:00+02:00",
    hashtags: [...basisHashtags, "telegrambot"],
    caption:
      "Dit krijg je zodra er een plek vrijkomt: club, tijd, prijs en een link om direct te boeken. Koppel Telegram via je account — duurt ongeveer 30 seconden.\n\n#padel #vrijebaan #padelhaarlem #telegrambot",
    visual: {
      template: "editorial-carousel-v1",
      accent: "court-ball",
      slides: [{ eyebrow: "PING • ER IS PLEK", lines: [{ text: "Jij weet het" }, { text: "als eerste.", accent: true }], body: "Nieuwe padelplek gevonden. Club, tijd, prijs en boekingslink staan voor je klaar.", chips: ["Club", "Tijd", "Prijs", "Boek direct"], cta: "Koppel Telegram via je account", motif: "telegram" }],
    },
  },
  {
    strategyPosition: 4,
    subjectKey: "campaign:launch:4:behind-the-scenes",
    subjectId: "behind-the-scenes",
    contentType: "spotlight",
    format: "Statische behind-the-scenes-post",
    scheduledFor: "2026-08-13T19:00:00+02:00",
    hashtags: [...basisHashtags, "buildinpublic"],
    caption:
      "Gebouwd door een padeller die zelf gek werd van steeds opnieuw checken of er iets vrijkwam. Nu getest met vrienden in Haarlem — wie speelt mee als tester? 🙋\n\n#padel #vrijebaan #padelhaarlem #buildinpublic",
    visual: {
      template: "editorial-carousel-v1",
      accent: "court-ball",
      slides: [{ eyebrow: "BEHIND THE SCENES", lines: [{ text: "Gebouwd uit" }, { text: "padelfrustratie.", accent: true }], body: "Omdat vijf boekingsapps blijven verversen geen hobby hoort te zijn.", chips: ["Haarlem", "Padel", "Build in public"], cta: "Wie test er mee?", motif: "builder" }],
    },
  },
  {
    strategyPosition: 5,
    subjectKey: "campaign:launch:5:gratis",
    subjectId: "gratis-2026",
    contentType: "spotlight",
    format: "Statische statement-post",
    scheduledFor: "2026-08-16T19:00:00+02:00",
    hashtags: [...basisHashtags, "gratispadelapp"],
    caption:
      "VrijeBaan zit in de testfase. Registreer je als tester en gebruik de Radar en Telegram nu gratis. Geen creditcard, geen addertjes — eerst bewijzen dat de app het waard is. Nu meedoen via devrijebaan.nl.\n\n#padel #vrijebaan #padelhaarlem #gratispadelapp",
    visual: {
      template: "editorial-carousel-v1",
      accent: "court-ball",
      slides: [{ eyebrow: "TESTFASE", lines: [{ text: "Gratis" }, { text: "na registratie.", accent: true }], body: "Radar en Telegram. Geen creditcard. Help VrijeBaan beter te maken.", cta: "Test mee • devrijebaan.nl", motif: "free" }],
    },
  },
  // Posts 6–8 (5 aug 2026, Xander: "wees creatiever in posts, toon meer
  // acties van de website, toon iets van de instagram bot (niet de naam)
  // verzin iets van de werkwijze") — evergreen featurecontent i.p.v. nog een
  // live-tijdslot-post, zelfde 3-dagen-cadans als 2–5. Geen botnaam genoemd
  // in post 7, zoals gevraagd — alleen wat het doet, niet welk platform.
  {
    strategyPosition: 6,
    subjectKey: "campaign:launch:6:radar-features",
    subjectId: "radar-features",
    contentType: "tip",
    format: "Carrousel — Radar-features naast zoeken",
    scheduledFor: "2026-08-19T19:00:00+02:00",
    hashtags: [...basisHashtags, "padelradar"],
    caption:
      "Vrije plek gevonden? Volg de club, en je hoort het automatisch ook de volgende keer. Of stuur 'm meteen door naar je padelmaatje — met één tik.\n\nDe Radar doet meer dan alleen zoeken: volg je favoriete clubs, bewaar je zoekgebied, en deel een vondst met je groep. Alles gratis na registratie, alles op devrijebaan.nl/radar.\n\n#padel #vrijebaan #padelhaarlem #padelradar",
    visual: {
      template: "editorial-carousel-v1",
      accent: "court-ball",
      slides: [
        { eyebrow: "VRIJEBAAN • RADAR", lines: [{ text: "Meer dan" }, { text: "alleen zoeken.", accent: true }], body: "Volg clubs, bewaar je zoekgebied, deel met je groep.", motif: "radar" },
        { eyebrow: "ÉÉN TIK", lines: [{ text: "Volg. Bewaar." }, { text: "Deel.", accent: true }], chips: ["Volg een club", "Bewaar zoekgebied", "Deel met je groep", "Filter op tijd"], cta: "devrijebaan.nl/radar", motif: "radar" },
      ],
    },
  },
  {
    strategyPosition: 7,
    subjectKey: "campaign:launch:7:meldingen",
    subjectId: "meldingen-2026",
    contentType: "tip",
    format: "Carrousel — meldingen, platformnaam bewust weggelaten",
    scheduledFor: "2026-08-22T19:00:00+02:00",
    hashtags: [...basisHashtags, "meldingen"],
    caption:
      "Geen 5 apps meer opnieuw openen om te checken. Zet meldingen één keer aan via je account, en je hoort het vanzelf zodra er een plek vrijkomt bij een club die je volgt.\n\nClub, tijd, prijs — en een link om meteen te boeken.\n\n#padel #vrijebaan #padelhaarlem #meldingen",
    visual: {
      template: "editorial-carousel-v1",
      accent: "court-ball",
      slides: [
        { eyebrow: "ALTIJD OP DE HOOGTE", lines: [{ text: "Jij hoeft het" }, { text: "niet te checken.", accent: true }], body: "Wij checken voor je, en sturen een bericht zodra er plek is.", motif: "telegram" },
        { eyebrow: "ZO WERKT HET", lines: [{ text: "Eén keer" }, { text: "instellen.", accent: true }], chips: ["Club", "Tijd", "Prijs", "Boek direct"], cta: "Zet aan via je account — 30 sec", motif: "telegram" },
      ],
    },
  },
  {
    strategyPosition: 8,
    subjectKey: "campaign:launch:8:werkwijze",
    subjectId: "werkwijze-2026",
    contentType: "spotlight",
    format: "Carrousel — achter de schermen / werkwijze",
    scheduledFor: "2026-08-25T19:00:00+02:00",
    hashtags: [...basisHashtags, "buildinpublic"],
    caption:
      "Hoe checken wij dan? Elke paar minuten kijken we live bij tientallen padelclubs tegelijk — via drie verschillende boekingssystemen die normaal niks met elkaar te maken hebben.\n\nZodra er iets verandert dat bij jouw voorkeuren past, weet jij het als eerste. Geen mens die op F5 drukt.\n\n#padel #vrijebaan #padelhaarlem #buildinpublic",
    visual: {
      template: "editorial-carousel-v1",
      accent: "court-ball",
      slides: [
        { eyebrow: "ACHTER DE SCHERMEN", lines: [{ text: "Hoe wij" }, { text: "checken.", accent: true }], body: "Live, elke paar minuten, bij tientallen clubs tegelijk.", motif: "builder" },
        { eyebrow: "ÉÉN PLEK VOOR ALLES", lines: [{ text: "Drie systemen." }, { text: "Eén overzicht.", accent: true }], chips: ["Playtomic", "Meet & Play", "Foys / Peakz"], cta: "Geen mens die op F5 drukt", motif: "builder" },
      ],
    },
  },
];
