const STANDAARD_GRAPH_VERSIE = "v26.0";
const META_TIMEOUT_MS = 30_000;

type FetchLike = typeof fetch;

type MetaFoutPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    is_transient?: boolean;
    fbtrace_id?: string;
  };
};

export class MetaApiFout extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = "MetaApiFout";
    this.retryable = retryable;
  }
}

export type MetaConfiguratie = {
  accessToken: string;
  facebookPageId: string;
  instagramAccountId: string;
  graphApiVersion?: string;
};

export type MetaKoppeling = {
  pageId: string;
  pageName: string;
  instagramAccountId: string;
};

function vereisId(naam: string, waarde: string): string {
  if (!/^\d+$/.test(waarde)) throw new Error(`${naam} moet uitsluitend uit cijfers bestaan.`);
  return waarde;
}

function veiligeMetaFout(payload: MetaFoutPayload, status: number): MetaApiFout {
  const fout = payload.error;
  const code = fout?.code ? ` code ${fout.code}` : "";
  const subcode = fout?.error_subcode ? `/${fout.error_subcode}` : "";
  const trace = fout?.fbtrace_id ? `, trace ${fout.fbtrace_id}` : "";
  const omschrijving = fout?.message?.slice(0, 500) || `HTTP ${status}`;
  return new MetaApiFout(
    `Meta API${code}${subcode}: ${omschrijving}${trace}`,
    fout?.is_transient === true || status === 429 || status >= 500
  );
}

async function jsonPayload(response: Response): Promise<Record<string, unknown> & MetaFoutPayload> {
  try {
    return await response.json() as Record<string, unknown> & MetaFoutPayload;
  } catch {
    return {};
  }
}

export function maakMetaClient(configuratie: MetaConfiguratie, fetcher: FetchLike = fetch) {
  const versie = configuratie.graphApiVersion ?? STANDAARD_GRAPH_VERSIE;
  if (!/^v\d+\.\d+$/.test(versie)) throw new Error("META_GRAPH_API_VERSION heeft geen geldig formaat.");
  if (!configuratie.accessToken.trim()) throw new Error("META_ACCESS_TOKEN ontbreekt.");
  const pageId = vereisId("META_FACEBOOK_PAGE_ID", configuratie.facebookPageId);
  const instagramId = vereisId("META_INSTAGRAM_ACCOUNT_ID", configuratie.instagramAccountId);
  const basis = `https://graph.facebook.com/${versie}`;
  let accessToken = configuratie.accessToken;

  async function verzoek<T extends Record<string, unknown>>(
    pad: string,
    opties: { methode?: "GET" | "POST"; parameters?: Record<string, string>; publicatie?: boolean } = {}
  ): Promise<T> {
    const methode = opties.methode ?? "GET";
    const url = new URL(`${basis}/${pad.replace(/^\//, "")}`);
    const parameters = new URLSearchParams(opties.parameters ?? {});
    if (methode === "GET") url.search = parameters.toString();

    let response: Response;
    try {
      response = await fetcher(url, {
        method: methode,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(methode === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body: methode === "POST" ? parameters : undefined,
        signal: AbortSignal.timeout(META_TIMEOUT_MS),
      });
    } catch (fout) {
      const reden = fout instanceof Error ? fout.message : String(fout);
      // Bij de definitieve publish-call is een netwerkfout ambigu: Meta kan de
      // post al geplaatst hebben. Automatisch opnieuw proberen kan dupliceren.
      throw new MetaApiFout(`Meta API niet bereikbaar: ${reden.slice(0, 300)}`, !opties.publicatie);
    }

    const payload = await jsonPayload(response);
    if (!response.ok || payload.error) {
      const apiFout = veiligeMetaFout(payload, response.status);
      // Ook een HTTP 5xx/429 op de definitieve publish-call kan betekenen dat
      // Meta de post wel heeft geplaatst. Niet blind herhalen: dat maakt
      // dubbele posts waarschijnlijker dan een handmatige controle.
      if (opties.publicatie && apiFout.retryable) {
        throw new MetaApiFout(apiFout.message, false);
      }
      throw apiFout;
    }
    return payload as T;
  }

  async function wachtOpContainer(containerId: string): Promise<void> {
    for (let poging = 0; poging < 20; poging += 1) {
      const status = await verzoek<{ status_code?: string; status?: string }>(containerId, {
        parameters: { fields: "status_code,status" },
      });
      if (status.status_code === "FINISHED") return;
      if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
        throw new MetaApiFout(`Instagram mediacontainer ${status.status_code.toLowerCase()}: ${status.status ?? "onbekende fout"}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    throw new MetaApiFout("Instagram mediacontainer was niet binnen 30 seconden gereed.", true);
  }

  async function maakInstagramAfbeelding(imageUrl: string, carouselItem: boolean): Promise<string> {
    const antwoord = await verzoek<{ id?: string }>(`${instagramId}/media`, {
      methode: "POST",
      parameters: {
        image_url: imageUrl,
        ...(carouselItem ? { is_carousel_item: "true" } : {}),
      },
    });
    if (!antwoord.id) throw new MetaApiFout("Meta gaf geen Instagram-container-id terug.");
    await wachtOpContainer(antwoord.id);
    return antwoord.id;
  }

  async function publiceerInstagram(imageUrls: string[], caption: string): Promise<string> {
    if (imageUrls.length === 0 || imageUrls.length > 10) {
      throw new Error("Instagram ondersteunt voor deze worker 1 tot en met 10 afbeeldingen.");
    }

    let containerId: string;
    if (imageUrls.length === 1) {
      const antwoord = await verzoek<{ id?: string }>(`${instagramId}/media`, {
        methode: "POST",
        parameters: { image_url: imageUrls[0], caption },
      });
      if (!antwoord.id) throw new MetaApiFout("Meta gaf geen Instagram-container-id terug.");
      containerId = antwoord.id;
    } else {
      const kinderen: string[] = [];
      for (const imageUrl of imageUrls) kinderen.push(await maakInstagramAfbeelding(imageUrl, true));
      const antwoord = await verzoek<{ id?: string }>(`${instagramId}/media`, {
        methode: "POST",
        parameters: { media_type: "CAROUSEL", children: kinderen.join(","), caption },
      });
      if (!antwoord.id) throw new MetaApiFout("Meta gaf geen Instagram-carrousel-id terug.");
      containerId = antwoord.id;
    }

    await wachtOpContainer(containerId);
    const gepubliceerd = await verzoek<{ id?: string }>(`${instagramId}/media_publish`, {
      methode: "POST",
      parameters: { creation_id: containerId },
      publicatie: true,
    });
    if (!gepubliceerd.id) throw new MetaApiFout("Meta gaf geen Instagram-post-id terug.");
    return gepubliceerd.id;
  }

  async function publiceerFacebook(imageUrls: string[], caption: string): Promise<string> {
    if (imageUrls.length === 0 || imageUrls.length > 10) {
      throw new Error("Facebook ondersteunt voor deze worker 1 tot en met 10 afbeeldingen.");
    }

    if (imageUrls.length === 1) {
      const foto = await verzoek<{ id?: string; post_id?: string }>(`${pageId}/photos`, {
        methode: "POST",
        parameters: { url: imageUrls[0], message: caption, published: "true" },
        publicatie: true,
      });
      const postId = foto.post_id ?? foto.id;
      if (!postId) throw new MetaApiFout("Meta gaf geen Facebook-post-id terug.");
      return postId;
    }

    const fotoIds: string[] = [];
    for (const imageUrl of imageUrls) {
      const foto = await verzoek<{ id?: string }>(`${pageId}/photos`, {
        methode: "POST",
        parameters: { url: imageUrl, published: "false" },
      });
      if (!foto.id) throw new MetaApiFout("Meta gaf geen Facebook-foto-id terug.");
      fotoIds.push(foto.id);
    }

    const parameters: Record<string, string> = { message: caption };
    fotoIds.forEach((id, index) => {
      parameters[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
    });
    const bericht = await verzoek<{ id?: string }>(`${pageId}/feed`, {
      methode: "POST",
      parameters,
      publicatie: true,
    });
    if (!bericht.id) throw new MetaApiFout("Meta gaf geen Facebook-bericht-id terug.");
    return bericht.id;
  }

  async function controleerKoppeling(): Promise<MetaKoppeling> {
    const accounts = await verzoek<{
      data?: Array<{
        id?: string;
        name?: string;
        access_token?: string;
        instagram_business_account?: { id?: string };
      }>;
    }>("me/accounts", {
      parameters: { fields: "id,name,access_token,instagram_business_account", limit: "100" },
    });
    const pagina = accounts.data?.find((account) => account.id === pageId);
    if (!pagina) throw new MetaApiFout("Het Meta System User-token heeft geen toegang tot de ingestelde Facebook-pagina.");
    const gekoppeldInstagramId = pagina.instagram_business_account?.id;
    if (gekoppeldInstagramId !== instagramId) {
      throw new MetaApiFout("Het ingestelde Instagram-account is niet aan deze Facebook-pagina gekoppeld.");
    }
    if (!pagina.access_token) {
      throw new MetaApiFout("Meta gaf geen Page Access Token terug voor de ingestelde Facebook-pagina.");
    }
    // Facebook vereist dit paginatoken voor ongepubliceerde foto-objecten in
    // een carrousel. De System User-token blijft de duurzame serversecret;
    // het paginatoken wordt bij iedere worker-run opnieuw afgeleid.
    accessToken = pagina.access_token;
    return { pageId, pageName: pagina.name ?? "Onbekende pagina", instagramAccountId: instagramId };
  }

  return { controleerKoppeling, publiceerFacebook, publiceerInstagram };
}

export type MetaClient = ReturnType<typeof maakMetaClient>;
