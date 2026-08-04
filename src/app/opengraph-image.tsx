import { ImageResponse } from "next/og";

// Standaard OG/Twitter-afbeelding voor de hele site — Xander (4 aug 2026):
// "als ik hem deel staat er..." — de sitepreview bij delen (WhatsApp,
// Facebook, Telegram) had helemaal geen afbeelding, alleen titel/tekst.
// Next.js' ingebouwde opengraph-image-conventie genereert deze automatisch
// en koppelt 'm aan de metadata — geen los <meta property="og:image">
// nodig in layout.tsx.
export const alt = "VrijeBaan — Vind een vrije padelbaan in de buurt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0b1412",
          padding: "0 560px 0 100px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: "#f4f6f2" }}>
          <span style={{ color: "#cbec27" }}>Vrije</span>
          <span>Baan</span>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#c9d1c9", lineHeight: 1.4 }}>
          Nooit meer zelf checken of er een padelbaan vrijkomt.
        </div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 34, fontWeight: 700, color: "#cbec27" }}>
          Dit jaar 100% gratis.
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 90,
            top: 155,
            width: 320,
            height: 320,
            borderRadius: 160,
            background: "#cbec27",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
