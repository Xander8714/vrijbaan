"use server";

import { revalidatePath } from "next/cache";
import { archiveerConcept, genereerEnBewaarAvondConcept, genereerEnBewaarConcept, keurConceptGoed } from "@/lib/socialMedia/repository";
import { vereisSocialMediaAdmin } from "@/lib/socialMedia/admin";

export type GenereerConceptState = {
  status: "idle" | "success" | "error";
  message: string;
};

function foutmelding(fout: unknown): string {
  return fout instanceof Error ? fout.message : "Concept genereren mislukt.";
}

function verplichtId(formData: FormData): string {
  const id = formData.get("id");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Ongeldig concept-id.");
  return id;
}

export async function genereerConceptAction(_vorige: GenereerConceptState): Promise<GenereerConceptState> {
  void _vorige;
  try {
    await vereisSocialMediaAdmin();
    await genereerEnBewaarConcept();
    revalidatePath("/beheer/social-media");
    return { status: "success", message: "Nieuw clubconcept staat klaar voor goedkeuring." };
  } catch (fout) {
    return { status: "error", message: foutmelding(fout) };
  }
}

export async function genereerAvondConceptAction(_vorige: GenereerConceptState): Promise<GenereerConceptState> {
  void _vorige;
  try {
    await vereisSocialMediaAdmin();
    await genereerEnBewaarAvondConcept();
    revalidatePath("/beheer/social-media");
    return { status: "success", message: "De dagelijkse 3-stedenpost staat klaar voor goedkeuring." };
  } catch (fout) {
    return { status: "error", message: foutmelding(fout) };
  }
}

export async function keurConceptGoedAction(formData: FormData): Promise<void> {
  const admin = await vereisSocialMediaAdmin();
  const id = verplichtId(formData);
  const ruwMoment = formData.get("scheduledFor");
  let geplandVoor: string | null = null;
  if (typeof ruwMoment === "string" && ruwMoment.trim()) {
    const datum = new Date(ruwMoment);
    if (Number.isNaN(datum.getTime()) || datum.getTime() <= Date.now()) {
      throw new Error("Kies een geldig toekomstig publicatiemoment.");
    }
    geplandVoor = datum.toISOString();
  }
  await keurConceptGoed(id, admin.id, geplandVoor);
  revalidatePath("/beheer/social-media");
}

export async function archiveerConceptAction(formData: FormData): Promise<void> {
  const admin = await vereisSocialMediaAdmin();
  await archiveerConcept(verplichtId(formData), admin.id);
  revalidatePath("/beheer/social-media");
}
