type ApiFout = { error?: unknown };

/** Leest alleen echte JSON en vertaalt proxy-/HTML-fouten naar gewone tekst. */
export async function leesJsonRespons<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    // Body consumeren zodat de verbinding netjes kan worden hergebruikt, maar
    // de HTML van nginx nooit aan de gebruiker tonen.
    await response.text().catch(() => "");
    if (response.status === 504) {
      throw new Error("Beschikbaarheid ophalen duurde te lang. Verklein je straal of probeer het opnieuw.");
    }
    throw new Error(`Beschikbaarheid ophalen mislukt (serverstatus ${response.status}).`);
  }

  let data: T & ApiFout;
  try {
    data = await response.json() as T & ApiFout;
  } catch {
    throw new Error("De server stuurde een ongeldig antwoord. Probeer het opnieuw.");
  }
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Ophalen mislukt (status ${response.status}).`);
  }
  return data;
}
