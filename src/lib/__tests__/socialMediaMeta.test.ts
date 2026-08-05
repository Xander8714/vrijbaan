import { describe, expect, it, vi } from "vitest";

import { maakMetaClient, MetaApiFout } from "../socialMedia/meta";

const configuratie = {
  accessToken: "geheim-systeemtoken",
  facebookPageId: "1225916397274389",
  instagramAccountId: "17841400000000000",
  graphApiVersion: "v26.0",
};

function antwoord(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function leegFetchAntwoord(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  void input;
  void init;
  return antwoord({});
}

describe("Meta socialmedia-client", () => {
  it("controleert of de Facebook-pagina aan het ingestelde Instagram-account is gekoppeld", async () => {
    const fetcher = vi.fn(leegFetchAntwoord).mockResolvedValueOnce(antwoord({
      data: [{
        id: configuratie.facebookPageId,
        name: "De Vrije Baan",
        access_token: "afgeleid-paginatoken",
        instagram_business_account: { id: configuratie.instagramAccountId },
      }],
    }));
    const client = maakMetaClient(configuratie, fetcher as typeof fetch);

    await expect(client.controleerKoppeling()).resolves.toEqual({
      pageId: configuratie.facebookPageId,
      pageName: "De Vrije Baan",
      instagramAccountId: configuratie.instagramAccountId,
    });

    const [url, opties] = fetcher.mock.calls[0];
    expect(String(url)).not.toContain(configuratie.accessToken);
    expect((opties as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${configuratie.accessToken}`,
    });
  });

  it("gebruikt na de koppeling het afgeleide paginatoken voor Facebook", async () => {
    const fetcher = vi.fn(leegFetchAntwoord)
      .mockResolvedValueOnce(antwoord({
        data: [{
          id: configuratie.facebookPageId,
          name: "De Vrije Baan",
          access_token: "afgeleid-paginatoken",
          instagram_business_account: { id: configuratie.instagramAccountId },
        }],
      }))
      .mockResolvedValueOnce(antwoord({ id: "facebook-post-1" }));
    const client = maakMetaClient(configuratie, fetcher as typeof fetch);

    await client.controleerKoppeling();
    await client.publiceerFacebook(["https://example.com/post.jpg"], "Test");

    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: "Bearer afgeleid-paginatoken",
    });
  });

  it("maakt, controleert en publiceert een Instagram-afbeelding", async () => {
    const fetcher = vi.fn(leegFetchAntwoord)
      .mockResolvedValueOnce(antwoord({ id: "container-1" }))
      .mockResolvedValueOnce(antwoord({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(antwoord({ id: "instagram-post-1" }));
    const client = maakMetaClient(configuratie, fetcher as typeof fetch);

    await expect(client.publiceerInstagram(
      ["https://example.com/post.jpg"],
      "Een nieuwe baan gevonden 🎾"
    )).resolves.toBe("instagram-post-1");

    const createBody = fetcher.mock.calls[0][1]?.body as URLSearchParams;
    expect(createBody.get("image_url")).toBe("https://example.com/post.jpg");
    expect(createBody.get("caption")).toContain("nieuwe baan");
    expect(String(fetcher.mock.calls[2][0]).endsWith(
      `/${configuratie.instagramAccountId}/media_publish`
    )).toBe(true);
  });

  it("publiceert een Facebook-carrousel met ongepubliceerde foto-objecten", async () => {
    const fetcher = vi.fn(leegFetchAntwoord)
      .mockResolvedValueOnce(antwoord({ id: "foto-1" }))
      .mockResolvedValueOnce(antwoord({ id: "foto-2" }))
      .mockResolvedValueOnce(antwoord({ id: "facebook-post-1" }));
    const client = maakMetaClient(configuratie, fetcher as typeof fetch);

    await expect(client.publiceerFacebook(
      ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      "Bekijk de vrije banen"
    )).resolves.toBe("facebook-post-1");

    const eersteFoto = fetcher.mock.calls[0][1]?.body as URLSearchParams;
    const feed = fetcher.mock.calls[2][1]?.body as URLSearchParams;
    expect(eersteFoto.get("published")).toBe("false");
    expect(feed.get("attached_media[0]")).toBe(JSON.stringify({ media_fbid: "foto-1" }));
    expect(feed.get("attached_media[1]")).toBe(JSON.stringify({ media_fbid: "foto-2" }));
  });

  it("publiceert een afbeelding als Instagram Story", async () => {
    const fetcher = vi.fn(leegFetchAntwoord)
      .mockResolvedValueOnce(antwoord({ id: "story-container-1" }))
      .mockResolvedValueOnce(antwoord({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(antwoord({ id: "instagram-story-1" }));
    const client = maakMetaClient(configuratie, fetcher as typeof fetch);

    await expect(client.publiceerInstagramStory("https://example.com/story.jpg"))
      .resolves.toBe("instagram-story-1");

    const createBody = fetcher.mock.calls[0][1]?.body as URLSearchParams;
    expect(createBody.get("image_url")).toBe("https://example.com/story.jpg");
    expect(createBody.get("media_type")).toBe("STORIES");
  });

  it("publiceert een ongepubliceerde Facebook-foto als Page Story", async () => {
    const fetcher = vi.fn(leegFetchAntwoord)
      .mockResolvedValueOnce(antwoord({ id: "facebook-foto-1" }))
      .mockResolvedValueOnce(antwoord({ post_id: "facebook-story-1" }));
    const client = maakMetaClient(configuratie, fetcher as typeof fetch);

    await expect(client.publiceerFacebookStory("https://example.com/story.jpg"))
      .resolves.toBe("facebook-story-1");

    const uploadBody = fetcher.mock.calls[0][1]?.body as URLSearchParams;
    const storyBody = fetcher.mock.calls[1][1]?.body as URLSearchParams;
    expect(String(fetcher.mock.calls[0][0])).toMatch(/\/photos$/);
    expect(uploadBody.get("published")).toBe("false");
    expect(String(fetcher.mock.calls[1][0])).toMatch(/\/photo_stories$/);
    expect(storyBody.get("photo_id")).toBe("facebook-foto-1");
  });

  it("probeert een ambigue definitieve publish-call niet automatisch opnieuw", async () => {
    const fetcher = vi.fn(leegFetchAntwoord)
      .mockResolvedValueOnce(antwoord({ id: "container-1" }))
      .mockResolvedValueOnce(antwoord({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(antwoord({ error: { message: "Tijdelijk niet beschikbaar", is_transient: true } }, 503));
    const client = maakMetaClient(configuratie, fetcher as typeof fetch);

    const fout = await client.publiceerInstagram(["https://example.com/post.jpg"], "Test")
      .catch((reden) => reden);

    expect(fout).toBeInstanceOf(MetaApiFout);
    expect(fout.retryable).toBe(false);
  });
});
