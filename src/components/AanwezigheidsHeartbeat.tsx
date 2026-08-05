"use client";

import { useEffect } from "react";
import { useGebruiker } from "@/lib/useGebruiker";

const INTERVAL_MS = 4 * 60 * 1000;

export default function AanwezigheidsHeartbeat() {
  const gebruiker = useGebruiker();

  useEffect(() => {
    if (!gebruiker) return;
    let laatstVerstuurd = 0;

    const meldAanwezig = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - laatstVerstuurd < 60_000) return;
      laatstVerstuurd = Date.now();
      fetch("/api/account/aanwezig", { method: "POST", keepalive: true }).catch(() => {});
    };

    meldAanwezig();
    const interval = window.setInterval(meldAanwezig, INTERVAL_MS);
    const bijZichtbaar = () => meldAanwezig();
    document.addEventListener("visibilitychange", bijZichtbaar);
    window.addEventListener("focus", bijZichtbaar);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", bijZichtbaar);
      window.removeEventListener("focus", bijZichtbaar);
    };
  }, [gebruiker]);

  return null;
}
