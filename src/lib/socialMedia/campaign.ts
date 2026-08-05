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
      "Zo werkt de Radar: kies je locatie, stel je straal in en tik op Zoek nu. Je ziet meteen welke clubs vrije banen hebben. Probeer ’m gratis via devrijebaan.nl/radar 🎾\n\n#padel #vrijebaan #padelhaarlem #padelradar",
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
      "Ja, echt gratis. Geen creditcard, geen addertjes. We testen dit jaar met een kleine groep voordat we ooit aan betalen denken — en dan alleen als de app het waard is. Nu meedoen via devrijebaan.nl.\n\n#padel #vrijebaan #padelhaarlem #gratispadelapp",
    visual: {
      template: "editorial-carousel-v1",
      accent: "court-ball",
      slides: [{ eyebrow: "DIT JAAR", lines: [{ text: "100%" }, { text: "gratis.", accent: true }], body: "Geen creditcard. Geen addertjes. Eerst bewijzen dat VrijeBaan het waard is.", cta: "Nu meedoen • devrijebaan.nl", motif: "free" }],
    },
  },
];
