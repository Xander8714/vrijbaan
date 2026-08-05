"use client";

import { useActionState } from "react";
import {
  genereerAvondConceptAction,
  genereerConceptAction,
  type GenereerConceptState,
} from "./actions";

const BEGINSTATUS: GenereerConceptState = { status: "idle", message: "" };

function meldingKleur(status: GenereerConceptState["status"]): string {
  return status === "error" ? "text-red-700" : "text-emerald-700";
}

export function ConceptGeneratorKnoppen({ avondGeblokkeerd }: { avondGeblokkeerd: string | null }) {
  const [clubState, clubAction, clubBezig] = useActionState(genereerConceptAction, BEGINSTATUS);
  const [avondState, avondAction, avondBezig] = useActionState(genereerAvondConceptAction, BEGINSTATUS);

  return (
    <div className="flex max-w-xl flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <form action={clubAction}>
          <button disabled={clubBezig} className="rounded-lg bg-court-700 px-5 py-3 font-semibold text-white shadow-sm hover:bg-court-800 disabled:cursor-wait disabled:opacity-60">
            {clubBezig ? "Bezig…" : "Genereer nieuw concept"}
          </button>
        </form>
        <form action={avondAction}>
          <button
            disabled={avondBezig || Boolean(avondGeblokkeerd)}
            className="rounded-lg border border-court-700 px-5 py-3 font-semibold text-court-700 shadow-sm hover:bg-court-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
          >
            {avondBezig ? "Bezig…" : avondGeblokkeerd ? "3-stedenpost bestaat al" : "Genereer 3-stedenpost"}
          </button>
        </form>
      </div>
      {avondGeblokkeerd ? <p className="text-sm text-slate-600">{avondGeblokkeerd}</p> : null}
      {clubState.message ? <p aria-live="polite" className={`text-sm ${meldingKleur(clubState.status)}`}>{clubState.message}</p> : null}
      {avondState.message ? <p aria-live="polite" className={`text-sm ${meldingKleur(avondState.status)}`}>{avondState.message}</p> : null}
    </div>
  );
}
