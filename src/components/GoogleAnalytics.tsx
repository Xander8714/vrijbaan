import Script from "next/script";

/**
 * Google Analytics (GA4) — staat pas iets te doen zodra
 * NEXT_PUBLIC_GA_MEASUREMENT_ID gezet is (Vercel-dashboard + .env.local).
 * Zonder die variabele rendert dit component niets: geen lege/kapotte
 * gtag-aanroep, en geen tracking-poging vóórdat er een echt GA4-property is.
 *
 * ID ophalen: analytics.google.com → Beheerder → property aanmaken → Data
 * streams → Web → "Measurement ID" (vorm G-XXXXXXXXXX).
 */
export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
