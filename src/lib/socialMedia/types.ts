export type BeschikbaarheidsSlot = {
  startTime: string;
  prijs?: string | null;
};

export type BeschikbaarheidsKandidaat = {
  clubId: string;
  clubNaam: string;
  stad: string;
  datum: string;
  bijgewerktOp: string;
  sloten: BeschikbaarheidsSlot[];
};

export type AvailabilityVisual = {
  template: "availability-v1";
  eyebrow: string;
  headline: string;
  subline: string;
  times: string[];
  cta: string;
  accent: "court-ball";
};

export type EditorialSlide = {
  eyebrow: string;
  lines: Array<{ text: string; accent?: boolean }>;
  body?: string;
  chips?: string[];
  cta?: string;
  motif: "radar" | "telegram" | "builder" | "free";
};

export type EditorialVisual = {
  template: "editorial-carousel-v1";
  slides: EditorialSlide[];
  accent: "court-ball";
};

export type AvailabilityCarouselVisual = {
  template: "availability-carousel-v1";
  slides: AvailabilityVisual[];
  accent: "court-ball";
};

export type SocialVisual = AvailabilityVisual | AvailabilityCarouselVisual | EditorialVisual;

export type GegenereerdConcept = {
  status: "pending_approval";
  // "statistic" toegevoegd (5 aug 2026) voor de dagelijkse tellingpost — zie
  // kiesDagelijkseTelling/bouwDagelijkseTellingConcept in generator.ts. Al
  // een geldige waarde in de social_media_posts content_type-check-
  // constraint (supabase/migraties/2026-08-05-social-media-posts.sql), dus
  // geen nieuwe migratie nodig.
  contentType: "availability" | "statistic";
  subjectKey: string;
  // "national" erbij voor de tellingpost — die gaat niet over één club/stad
  // maar over de hele testregio (6 steden), en dat past qua granulariteit
  // dichter bij "national" dan bij "city" (geen check-constraintwaarde dekt
  // "meerdere-steden-samen" precies).
  subjectType: "club" | "national";
  subjectId: string;
  city: string | null;
  clubId: string | null;
  caption: string;
  hashtags: string[];
  visual: SocialVisual;
  dataSnapshot: Record<string, unknown>;
  sourceUpdatedAt: string;
  platforms: ["instagram", "facebook"];
};

/** Eén club met een vrije plek op het gekozen tijdstip van de dagelijkse telling. */
export type TellingClub = { clubId: string; clubNaam: string; stad: string };

/**
 * Resultaat van kiesDagelijkseTelling: het tijdstip vandaag waarop de meeste
 * testregio-clubs tegelijk een vrije plek hebben, plus welke clubs dat zijn.
 */
export type DagelijkseTellingKandidaat = {
  datum: string;
  tijd: string;
  clubs: TellingClub[];
  oudsteBijgewerktOp: string;
};

export type AvondStadKandidaat = {
  stad: string;
  clubIds: string[];
  tijden: string[];
};

export type DagelijkseAvondKandidaat = {
  datum: string;
  steden: AvondStadKandidaat[];
  oudsteBijgewerktOp: string;
};

export type SocialPostStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "archived";
