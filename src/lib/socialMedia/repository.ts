import { CLUBS_INCLUSIEF_LEDENCLUBS } from "@/lib/clubs";
import { alleTestregioClubs } from "@/lib/stadsPaginas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  bouwBeschikbaarheidsConcept,
  bouwDagelijkseTellingConcept,
  HERHALINGSVENSTER_DAGEN,
  kiesDagelijkseTelling,
  kiesInteressantsteBeschikbaarheid,
} from "./generator";
import { LAUNCH_CAMPAGNE } from "./campaign";
import { meldNieuwConceptViaTelegram } from "./telegramGoedkeuring";
import type { BeschikbaarheidsKandidaat, BeschikbaarheidsSlot, GegenereerdConcept, SocialPostStatus, SocialVisual } from "./types";

const DAGEN_VOORUIT = 7;
const TESTREGIO_CLUB_IDS = new Set(alleTestregioClubs().map((club) => club.id));

export type SocialPostVoorBeheer = {
  id: string;
  status: SocialPostStatus;
  contentType: string;
  subjectKey: string;
  city: string | null;
  clubId: string | null;
  caption: string;
  hashtags: string[];
  visual: SocialVisual;
  scheduledFor: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  sourceUpdatedAt: string | null;
  platforms: string[];
  lastError: string | null;
  externalPostIds: Record<string, string>;
  nextRetryAt: string | null;
};

function isoDatum(datum: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(datum);
}

function normaliseerSloten(waarde: unknown): BeschikbaarheidsSlot[] {
  if (!Array.isArray(waarde)) return [];
  return waarde.flatMap((slot) => {
    if (!slot || typeof slot !== "object") return [];
    const item = slot as Record<string, unknown>;
    if (typeof item.startTime !== "string" || !/^\d{2}:\d{2}$/.test(item.startTime)) return [];
    return [{ startTime: item.startTime, prijs: typeof item.prijs === "string" ? item.prijs : null }];
  });
}

/**
 * Alleen clubs uit de zes teststeden gebruiken voor automatische content:
 * Amsterdam, Haarlem, Groningen, Utrecht, Den Haag en Rijswijk. De landelijke
 * clubdata blijft wel beschikbaar voor Radar en meldingen.
 */
async function haalBeschikbaarheidsKandidaten(nu: Date): Promise<BeschikbaarheidsKandidaat[]> {
  const supabase = supabaseAdmin();
  const einddatum = new Date(nu);
  einddatum.setUTCDate(einddatum.getUTCDate() + DAGEN_VOORUIT);
  const { data, error } = await supabase
    .from("club_beschikbaarheid")
    .select("club_id, datum, slots, bijgewerkt_op")
    .in("club_id", [...TESTREGIO_CLUB_IDS])
    .gte("datum", isoDatum(nu))
    .lte("datum", isoDatum(einddatum));
  if (error) throw new Error(`Beschikbaarheid lezen mislukt: ${error.message}`);

  const clubs = new Map(CLUBS_INCLUSIEF_LEDENCLUBS.map((club) => [club.id, club]));
  return (data ?? []).flatMap((rij): BeschikbaarheidsKandidaat[] => {
    if (!TESTREGIO_CLUB_IDS.has(rij.club_id as string)) return [];
    const club = clubs.get(rij.club_id as string);
    const sloten = normaliseerSloten(rij.slots);
    if (!club || sloten.length === 0) return [];
    return [{
      clubId: club.id,
      clubNaam: club.naam,
      stad: club.plaats,
      datum: String(rij.datum),
      bijgewerktOp: String(rij.bijgewerkt_op),
      sloten,
    }];
  });
}

/**
 * Alleen de testregio-clubs (6 steden, 5 aug 2026 — Xander: "alleen je
 * testeden" i.p.v. heel Nederland) uit een club_beschikbaarheid-rijenlijst
 * halen, voor de dagelijkse tellingpost.
 */
async function haalKandidatenVoorTelling(nu: Date): Promise<BeschikbaarheidsKandidaat[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("club_beschikbaarheid")
    .select("club_id, datum, slots, bijgewerkt_op")
    .in("club_id", [...TESTREGIO_CLUB_IDS])
    .eq("datum", isoDatum(nu));
  if (error) throw new Error(`Beschikbaarheid lezen (telling) mislukt: ${error.message}`);

  const clubs = new Map(CLUBS_INCLUSIEF_LEDENCLUBS.map((club) => [club.id, club]));
  return (data ?? []).flatMap((rij): BeschikbaarheidsKandidaat[] => {
    const clubId = rij.club_id as string;
    if (!TESTREGIO_CLUB_IDS.has(clubId)) return [];
    const club = clubs.get(clubId);
    const sloten = normaliseerSloten(rij.slots);
    if (!club || sloten.length === 0) return [];
    return [{
      clubId: club.id,
      clubNaam: club.naam,
      stad: club.plaats,
      datum: String(rij.datum),
      bijgewerktOp: String(rij.bijgewerkt_op),
      sloten,
    }];
  });
}

async function haalRecentGebruikteClubs(nu: Date): Promise<Set<string>> {
  const vanaf = new Date(nu);
  vanaf.setUTCDate(vanaf.getUTCDate() - HERHALINGSVENSTER_DAGEN);
  const { data, error } = await supabaseAdmin()
    .from("social_media_posts")
    .select("club_id")
    .gte("created_at", vanaf.toISOString())
    .not("club_id", "is", null);
  if (error) throw new Error(`Recente socialposts lezen mislukt: ${error.message}`);
  return new Set((data ?? []).map((rij) => rij.club_id as string));
}

export async function genereerConceptVoorbeeld(nu: Date = new Date()): Promise<GegenereerdConcept> {
  const [kandidaten, recent] = await Promise.all([
    haalBeschikbaarheidsKandidaten(nu),
    haalRecentGebruikteClubs(nu),
  ]);
  const kandidaat = kiesInteressantsteBeschikbaarheid(kandidaten, recent, nu);
  if (!kandidaat) throw new Error("Geen geschikte actuele beschikbaarheid gevonden die niet recent is gebruikt.");
  return bouwBeschikbaarheidsConcept(kandidaat);
}

/**
 * Gedeelde opslagstap voor elk concepttype (beschikbaarheid, telling, en de
 * campagneposts die hun eigen insert hebben) — was eerst alleen inline in
 * genereerEnBewaarConcept, maar de dagelijkse tellingpost (5 aug 2026) heeft
 * exact dezelfde dubbelcheck-en-insert nodig, dus hier één keer.
 */
async function bewaarConcept(concept: GegenereerdConcept, nu: Date): Promise<string> {
  // Ook afgewezen/gearchiveerde concepten tellen mee. Anders levert de knop
  // na een afwijzing direct opnieuw exact hetzelfde onderwerp op. `limit(1)`
  // houdt deze controle bruikbaar voor historische data waarin zo'n dubbel
  // onderwerp al voorkwam voordat deze blokkade bestond.
  const { data: bestaand, error: zoekFout } = await supabaseAdmin()
    .from("social_media_posts")
    .select("id")
    .eq("subject_key", concept.subjectKey)
    .limit(1)
    .maybeSingle();
  if (zoekFout) throw new Error(`Dubbelcheck van onderwerp mislukt: ${zoekFout.message}`);
  if (bestaand) throw new Error("Voor dit onderwerp is al eerder een concept gemaakt.");

  const { data, error } = await supabaseAdmin()
    .from("social_media_posts")
    .insert({
      status: concept.status,
      content_type: concept.contentType,
      subject_key: concept.subjectKey,
      subject_type: concept.subjectType,
      subject_id: concept.subjectId,
      city: concept.city,
      club_id: concept.clubId,
      caption: concept.caption,
      hashtags: concept.hashtags,
      visual: concept.visual,
      data_snapshot: concept.dataSnapshot,
      source_updated_at: concept.sourceUpdatedAt,
      platforms: concept.platforms,
      log: [{ at: nu.toISOString(), event: "concept_generated", mode: "approval" }],
    })
    .select("id")
    .single();
  if (error) throw new Error(`Concept opslaan mislukt: ${error.message}`);
  return data.id as string;
}

export async function genereerEnBewaarConcept(nu: Date = new Date()): Promise<string> {
  const concept = await genereerConceptVoorbeeld(nu);
  const id = await bewaarConcept(concept, nu);
  await meldNieuwConceptViaTelegram(id, concept);
  return id;
}

export async function genereerConceptVoorbeeldTelling(nu: Date = new Date()): Promise<GegenereerdConcept> {
  const kandidaten = await haalKandidatenVoorTelling(nu);
  const kandidaat = kiesDagelijkseTelling(kandidaten, isoDatum(nu), nu);
  if (!kandidaat) {
    throw new Error("Nog niet genoeg testregio-clubs met een vrije plek op hetzelfde moment vandaag voor een tellingpost.");
  }
  return bouwDagelijkseTellingConcept(kandidaat);
}

export async function genereerEnBewaarTellingConcept(nu: Date = new Date()): Promise<string> {
  const concept = await genereerConceptVoorbeeldTelling(nu);
  const id = await bewaarConcept(concept, nu);
  await meldNieuwConceptViaTelegram(id, concept);
  return id;
}

export async function planLaunchCampagne(nu: Date = new Date()): Promise<{ aangemaakt: number; overgeslagen: number }> {
  const supabase = supabaseAdmin();
  const sleutels = LAUNCH_CAMPAGNE.map((post) => post.subjectKey);
  const { data: bestaande, error: leesFout } = await supabase
    .from("social_media_posts")
    .select("subject_key")
    .in("subject_key", sleutels);
  if (leesFout) throw new Error(`Bestaande launchcampagne lezen mislukt: ${leesFout.message}`);
  const bestaand = new Set((bestaande ?? []).map((rij) => rij.subject_key as string));
  const nieuw = LAUNCH_CAMPAGNE.filter((post) => !bestaand.has(post.subjectKey));
  if (nieuw.length === 0) return { aangemaakt: 0, overgeslagen: LAUNCH_CAMPAGNE.length };

  const { error } = await supabase.from("social_media_posts").insert(nieuw.map((post) => ({
    status: "pending_approval",
    content_type: post.contentType,
    subject_key: post.subjectKey,
    subject_type: "national",
    subject_id: post.subjectId,
    caption: post.caption,
    hashtags: post.hashtags,
    visual: post.visual,
    data_snapshot: {
      campaign: "launch-2026",
      strategyPosition: post.strategyPosition,
      format: post.format,
      cadenceDays: 3,
      existingIntroductionPostIsPosition1: true,
    },
    scheduled_for: post.scheduledFor,
    platforms: ["instagram", "facebook"],
    log: [{ at: nu.toISOString(), event: "campaign_post_planned", mode: "approval", scheduledFor: post.scheduledFor }],
  })));
  if (error) throw new Error(`Launchcampagne plannen mislukt: ${error.message}`);
  return { aangemaakt: nieuw.length, overgeslagen: LAUNCH_CAMPAGNE.length - nieuw.length };
}

export async function haalSocialPostsVoorBeheer(): Promise<SocialPostVoorBeheer[]> {
  const { data, error } = await supabaseAdmin()
    .from("social_media_posts")
    .select("id, status, content_type, subject_key, city, club_id, caption, hashtags, visual, scheduled_for, approved_at, published_at, created_at, source_updated_at, platforms, external_post_ids, last_error, next_retry_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Socialposts lezen mislukt: ${error.message}`);
  return (data ?? []).map((rij) => ({
    id: rij.id as string,
    status: rij.status as SocialPostStatus,
    contentType: rij.content_type as string,
    subjectKey: rij.subject_key as string,
    city: rij.city as string | null,
    clubId: rij.club_id as string | null,
    caption: rij.caption as string,
    hashtags: (rij.hashtags as string[]) ?? [],
    visual: rij.visual as SocialVisual,
    scheduledFor: rij.scheduled_for as string | null,
    approvedAt: rij.approved_at as string | null,
    publishedAt: rij.published_at as string | null,
    createdAt: rij.created_at as string,
    sourceUpdatedAt: rij.source_updated_at as string | null,
    platforms: (rij.platforms as string[]) ?? [],
    lastError: rij.last_error as string | null,
    externalPostIds: (rij.external_post_ids as Record<string, string> | null) ?? {},
    nextRetryAt: rij.next_retry_at as string | null,
  }));
}

export async function haalSocialPostVisual(id: string): Promise<SocialVisual | null> {
  const { data, error } = await supabaseAdmin()
    .from("social_media_posts")
    .select("visual")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Socialvisual lezen mislukt: ${error.message}`);
  return (data?.visual as SocialVisual | undefined) ?? null;
}

export async function keurConceptGoed(id: string, adminId: string, geplandVoor: string | null): Promise<void> {
  const nu = new Date().toISOString();
  const { data: huidig, error: leesFout } = await supabaseAdmin()
    .from("social_media_posts")
    .select("log")
    .eq("id", id)
    .eq("status", "pending_approval")
    .maybeSingle();
  if (leesFout) throw new Error(`Concept lezen mislukt: ${leesFout.message}`);
  if (!huidig) throw new Error("Concept bestaat niet of is al verwerkt.");
  const log = Array.isArray(huidig.log) ? huidig.log : [];
  const { error } = await supabaseAdmin()
    .from("social_media_posts")
    .update({
      status: geplandVoor ? "scheduled" : "approved",
      approved_by: adminId,
      approved_at: nu,
      scheduled_for: geplandVoor,
      updated_at: nu,
      log: [...log, { at: nu, event: geplandVoor ? "scheduled" : "approved", by: adminId }],
    })
    .eq("id", id)
    .eq("status", "pending_approval");
  if (error) throw new Error(`Concept goedkeuren mislukt: ${error.message}`);
}

export async function archiveerConcept(id: string, adminId: string): Promise<void> {
  const nu = new Date().toISOString();
  const { data: huidig, error: leesFout } = await supabaseAdmin()
    .from("social_media_posts")
    .select("log")
    .eq("id", id)
    .eq("status", "pending_approval")
    .maybeSingle();
  if (leesFout) throw new Error(`Concept lezen mislukt: ${leesFout.message}`);
  if (!huidig) throw new Error("Concept bestaat niet of is al verwerkt.");
  const log = Array.isArray(huidig.log) ? huidig.log : [];
  const { error } = await supabaseAdmin()
    .from("social_media_posts")
    .update({ status: "archived", updated_at: nu, log: [...log, { at: nu, event: "archived", by: adminId }] })
    .eq("id", id)
    .eq("status", "pending_approval");
  if (error) throw new Error(`Concept archiveren mislukt: ${error.message}`);
}
