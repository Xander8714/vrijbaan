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

export type SocialVisual = {
  template: "availability-v1";
  eyebrow: string;
  headline: string;
  subline: string;
  times: string[];
  cta: string;
  accent: "court-ball";
};

export type GegenereerdConcept = {
  status: "pending_approval";
  contentType: "availability";
  subjectKey: string;
  subjectType: "club";
  subjectId: string;
  city: string;
  clubId: string;
  caption: string;
  hashtags: string[];
  visual: SocialVisual;
  dataSnapshot: Record<string, unknown>;
  sourceUpdatedAt: string;
  platforms: ["instagram", "facebook"];
};

export type SocialPostStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "published"
  | "failed"
  | "archived";
