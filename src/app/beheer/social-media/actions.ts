"use server";

import { revalidatePath } from "next/cache";
import { archiveerConcept, genereerEnBewaarConcept, keurConceptGoed } from "@/lib/socialMedia/repository";
import { vereisSocialMediaAdmin } from "@/lib/socialMedia/admin";

function verplichtId(formData: FormData): string {
  const id = formData.get("id");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Ongeldig concept-id.");
  return id;
}

export async function genereerConceptAction(): Promise<void> {
  await vereisSocialMediaAdmin();
  await genereerEnBewaarConcept();
  revalidatePath("/beheer/social-media");
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
