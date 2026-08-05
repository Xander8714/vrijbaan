import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MetaApiFout, maakMetaClient, type MetaClient } from "./meta";
import { renderSocialVisualJpeg } from "./media";
import type { SocialVisual } from "./types";
import { aantalSocialVisualSlides, isSocialStoryVisual } from "./visual";

const STANDAARD_BUCKET = "social-media";
const MAXIMALE_POGINGEN = 5;

type Platform = "instagram" | "facebook";

type PublicatiePost = {
  id: string;
  status: string;
  caption: string;
  visual: SocialVisual;
  platforms: string[];
  external_post_ids: Record<string, string> | null;
  retry_count: number;
  log: unknown;
};

export type MediaAsset = {
  slide: number;
  storagePath: string;
  publicUrl: string;
  mimeType: "image/jpeg";
};

export type PublicatieResultaat =
  | { status: "idle" }
  | { status: "published"; postId: string; externalPostIds: Record<string, string> }
  | { status: "failed"; postId: string; error: string; retryAt: string | null };

function logRegels(waarde: unknown): unknown[] {
  return Array.isArray(waarde) ? waarde : [];
}

function veiligeFout(fout: unknown): string {
  const tekst = fout instanceof Error ? fout.message : String(fout);
  return tekst
    .replace(/(?:EAA|IGQ)[A-Za-z0-9_-]{20,}/g, "[META_TOKEN_VERWIJDERD]")
    .slice(0, 1_000);
}

function retryMoment(poging: number, nu: Date): string {
  const minuten = [5, 15, 60, 360][Math.min(Math.max(poging - 1, 0), 3)];
  return new Date(nu.getTime() + minuten * 60_000).toISOString();
}

function geldigePlatforms(platforms: string[]): Platform[] {
  const uniek = [...new Set(platforms)];
  if (uniek.length === 0 || uniek.some((platform) => platform !== "instagram" && platform !== "facebook")) {
    throw new Error(`Ongeldige publicatieplatforms: ${uniek.join(", ") || "geen"}.`);
  }
  return uniek as Platform[];
}

export function leesMetaConfiguratieUitOmgeving() {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim() ?? "";
  const facebookPageId = process.env.META_FACEBOOK_PAGE_ID?.trim() ?? "";
  const instagramAccountId = process.env.META_INSTAGRAM_ACCOUNT_ID?.trim() ?? "";
  if (!accessToken || !facebookPageId || !instagramAccountId) {
    throw new Error("META_ACCESS_TOKEN, META_FACEBOOK_PAGE_ID en META_INSTAGRAM_ACCOUNT_ID moeten op de worker zijn ingesteld.");
  }
  return {
    accessToken,
    facebookPageId,
    instagramAccountId,
    graphApiVersion: process.env.META_GRAPH_API_VERSION?.trim() || "v26.0",
  };
}

async function uploadMedia(post: PublicatiePost, bucket: string): Promise<MediaAsset[]> {
  const supabase = supabaseAdmin();
  const versie = createHash("sha256").update(JSON.stringify(post.visual)).digest("hex").slice(0, 16);
  const aantal = aantalSocialVisualSlides(post.visual);
  const assets: MediaAsset[] = [];

  for (let slide = 0; slide < aantal; slide += 1) {
    const storagePath = `${post.id}/${versie}/slide-${slide + 1}.jpg`;
    const jpeg = await renderSocialVisualJpeg(post.visual, slide);
    const { error } = await supabase.storage.from(bucket).upload(storagePath, jpeg, {
      cacheControl: "31536000",
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw new Error(`Socialmedia-afbeelding uploaden mislukt: ${error.message}`);
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    assets.push({ slide: slide + 1, storagePath, publicUrl: data.publicUrl, mimeType: "image/jpeg" });
  }

  const nu = new Date().toISOString();
  const { error } = await supabase
    .from("social_media_posts")
    .update({
      image_url: assets[0]?.publicUrl ?? null,
      image_storage_path: assets[0]?.storagePath ?? null,
      media_assets: assets,
      updated_at: nu,
    })
    .eq("id", post.id)
    .eq("status", "publishing");
  if (error) throw new Error(`Mediaregistratie opslaan mislukt: ${error.message}`);
  return assets;
}

async function haalVoortgang(postId: string): Promise<{ ids: Record<string, string>; log: unknown[] }> {
  const { data, error } = await supabaseAdmin()
    .from("social_media_posts")
    .select("external_post_ids, log")
    .eq("id", postId)
    .eq("status", "publishing")
    .single();
  if (error) throw new Error(`Publicatievoortgang lezen mislukt: ${error.message}`);
  return {
    ids: data.external_post_ids && typeof data.external_post_ids === "object"
      ? data.external_post_ids as Record<string, string>
      : {},
    log: logRegels(data.log),
  };
}

async function bewaarPlatformPost(postId: string, platformSleutel: string, externalId: string): Promise<Record<string, string>> {
  const voortgang = await haalVoortgang(postId);
  const ids = { ...voortgang.ids, [platformSleutel]: externalId };
  const nu = new Date().toISOString();
  const { error } = await supabaseAdmin()
    .from("social_media_posts")
    .update({
      external_post_ids: ids,
      updated_at: nu,
      log: [...voortgang.log, { at: nu, event: "platform_published", platform: platformSleutel, externalId }],
    })
    .eq("id", postId)
    .eq("status", "publishing");
  if (error) {
    // De post staat op dit punt al live. Zonder duurzaam Meta-id zou een
    // automatische retry mogelijk een duplicaat plaatsen.
    throw new MetaApiFout(`Meta-post-id opslaan mislukt; handmatige controle nodig: ${error.message}`);
  }
  return ids;
}

async function markeerGepubliceerd(postId: string, externalPostIds: Record<string, string>): Promise<void> {
  const voortgang = await haalVoortgang(postId);
  const nu = new Date().toISOString();
  const { error } = await supabaseAdmin()
    .from("social_media_posts")
    .update({
      status: "published",
      published_at: nu,
      external_post_ids: externalPostIds,
      last_error: null,
      next_retry_at: null,
      publishing_started_at: null,
      publishing_worker: null,
      updated_at: nu,
      log: [...voortgang.log, { at: nu, event: "published", externalPostIds }],
    })
    .eq("id", postId)
    .eq("status", "publishing");
  if (error) throw new Error(`Gepubliceerde status opslaan mislukt: ${error.message}`);
}

async function markeerMislukt(post: PublicatiePost, fout: unknown, nu: Date): Promise<string | null> {
  const melding = veiligeFout(fout);
  const poging = (post.retry_count ?? 0) + 1;
  const automatischRetrybaar = !(fout instanceof MetaApiFout) || fout.retryable;
  const retryAt = poging < MAXIMALE_POGINGEN && automatischRetrybaar ? retryMoment(poging, nu) : null;
  const voortgang = await haalVoortgang(post.id);
  const { error } = await supabaseAdmin()
    .from("social_media_posts")
    .update({
      status: "failed",
      last_error: melding,
      retry_count: poging,
      next_retry_at: retryAt,
      publishing_started_at: null,
      publishing_worker: null,
      updated_at: nu.toISOString(),
      log: [...voortgang.log, {
        at: nu.toISOString(),
        event: "publication_failed",
        error: melding,
        retryAt,
        attempt: poging,
      }],
    })
    .eq("id", post.id)
    .eq("status", "publishing");
  if (error) throw new Error(`Mislukte publicatie opslaan mislukt: ${error.message}`);
  return retryAt;
}

async function claimVerschuldigdePost(workerId: string, nu: Date): Promise<PublicatiePost | null> {
  const { data, error } = await supabaseAdmin().rpc("claim_due_social_media_post", {
    p_worker_id: workerId,
    p_now: nu.toISOString(),
  });
  if (error) throw new Error(`Verschuldigde socialmediapost claimen mislukt: ${error.message}`);
  return (Array.isArray(data) && data[0] ? data[0] : null) as PublicatiePost | null;
}

export async function publiceerEenVerschuldigdePost(opties: {
  workerId?: string;
  nu?: Date;
  bucket?: string;
  metaClient?: MetaClient;
} = {}): Promise<PublicatieResultaat> {
  // Omgevingsvariabelen worden bewust vóór de databaseclaim gevalideerd.
  const metaClient = opties.metaClient ?? maakMetaClient(leesMetaConfiguratieUitOmgeving());
  const workerId = opties.workerId ?? (process.env.SOCIAL_MEDIA_WORKER_ID?.trim() || `social-${randomUUID()}`);
  const nu = opties.nu ?? new Date();
  const post = await claimVerschuldigdePost(workerId, nu);
  if (!post) return { status: "idle" };

  try {
    await metaClient.controleerKoppeling();
    const platforms = geldigePlatforms(post.platforms ?? []);
    const assets = await uploadMedia(
      post,
      opties.bucket ?? (process.env.SOCIAL_MEDIA_BUCKET?.trim() || STANDAARD_BUCKET)
    );
    const imageUrls = assets.map((asset) => asset.publicUrl);
    let ids = post.external_post_ids ?? {};

    const story = isSocialStoryVisual(post.visual);
    for (const platform of platforms) {
      if (!story) {
        if (ids[platform]) continue;
        const externalId = platform === "instagram"
          ? await metaClient.publiceerInstagram(imageUrls, post.caption)
          : await metaClient.publiceerFacebook(imageUrls, post.caption);
        ids = await bewaarPlatformPost(post.id, platform, externalId);
        continue;
      }

      for (const [index, imageUrl] of imageUrls.entries()) {
        const voortgangSleutel = `${platform}_story_${index + 1}`;
        if (ids[voortgangSleutel]) continue;
        const externalId = platform === "instagram"
          ? await metaClient.publiceerInstagramStory(imageUrl)
          : await metaClient.publiceerFacebookStory(imageUrl);
        ids = await bewaarPlatformPost(post.id, voortgangSleutel, externalId);
      }
    }

    const verwachteSleutels = story
      ? platforms.flatMap((platform) => imageUrls.map((_, index) => `${platform}_story_${index + 1}`))
      : platforms;
    if (verwachteSleutels.some((sleutel) => !ids[sleutel])) {
      throw new Error("Niet alle gevraagde platformen hebben een Meta-post-id teruggegeven.");
    }
    await markeerGepubliceerd(post.id, ids);
    return { status: "published", postId: post.id, externalPostIds: ids };
  } catch (fout) {
    const retryAt = await markeerMislukt(post, fout, new Date());
    return { status: "failed", postId: post.id, error: veiligeFout(fout), retryAt };
  }
}
