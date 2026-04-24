import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SWRegister } from "@/components/layout/SWRegister";
import { InstallPrompt } from "@/components/layout/InstallPrompt";
import { ToastViewport } from "@/components/layout/ToastViewport";
import { Providers } from "./providers";
import { SITE_URL } from "@/lib/config";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { I18N_BOOT_SCRIPT } from "@/lib/i18n/boot";
import { BIOMARKER_DB } from "@/lib/engine/biomarkers";
import { PATTERN_COUNT } from "@/lib/engine/patterns";
import "./globals.css";

const inter = Inter({ variable: "--font-geist-sans", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const TITLE = "Protocol — AI Longevity Engine";
// Counts derive from the engine so one new biomarker anywhere updates every
// surface — old hardcoded "37 biomarkers / 12 patterns" drifted out of sync.
const DESCRIPTION = `Your blood work. AI analysis. A longevity protocol built for YOU — not Bryan Johnson. ${BIOMARKER_DB.length} biomarkers, ${PATTERN_COUNT} health patterns, 8 organ systems. Personalized in 60 seconds.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s — Protocol",
  },
  description: DESCRIPTION,
  applicationName: "Protocol",
  keywords: [
    "longevity protocol", "biological age", "biomarker analysis", "blood test AI",
    "Bryan Johnson protocol", "PhenoAge", "DunedinPACE", "healthspan",
    "personalized supplements", "VO2 Max", "HbA1c", "CRP", "longevity score",
  ],
  authors: [{ name: "Protocol" }],
  creator: "Protocol",
  publisher: "Protocol",
  category: "health",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Protocol",
  },
  formatDetection: { telephone: false, address: false, email: false },
  referrer: "strict-origin-when-cross-origin",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Protocol",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: "Bryan Johnson spends $2M/year on longevity. You have your blood panel and AI.",
    creator: "@protocol",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // NOTE: no maximumScale / userScalable — disabling zoom is a WCAG violation
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08090d" },
    { media: "(prefers-color-scheme: light)", color: "#08090d" },
  ],
  colorScheme: "dark",
};

// JSON-LD structured data for search engines + social previews.
// Using WebApplication (not MedicalWebPage — we don't dispense medical advice).
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Protocol — AI Longevity Engine",
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "HealthApplication",
  applicationSubCategory: "Longevity",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    `${BIOMARKER_DB.length}-biomarker analysis`,
    "PhenoAge biological age estimation",
    "DunedinPACE-style aging velocity",
    `${PATTERN_COUNT} health pattern detection`,
    "8 organ-system scoring",
    "Bryan Johnson benchmark comparison",
    "Personalized supplement stack",
    "Daily wearable metric tracking",
    "Oura + Fitbit + Withings OAuth sync",
  ],
  screenshot: `${SITE_URL}/opengraph-image`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        {/* Theme boot — runs synchronously before React hydrates so the
            user's saved theme (or OS preference) is applied to <html>
            before first paint. Prevents the dark→light flash an effect-
            based applier would cause. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: I18N_BOOT_SCRIPT }}
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>
          {children}
        </Providers>
        <Analytics />
        <SWRegister />
        <InstallPrompt />
        {/* Global toast viewport — listens for events from lib/toast.ts.
            Mounted once at the root so any client component can call
            toast(...) and have it appear without provider plumbing. */}
        <ToastViewport />
      </body>
    </html>
  );
}
