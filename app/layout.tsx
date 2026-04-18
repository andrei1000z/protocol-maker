import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SWRegister } from "@/components/layout/SWRegister";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ variable: "--font-geist-sans", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = "https://protocol-tawny.vercel.app";
const TITLE = "Protocol — AI Longevity Engine";
const DESCRIPTION = "Your blood work. AI analysis. A longevity protocol built for YOU — not Bryan Johnson. 37 biomarkers, 12 health patterns, 8 organ systems. Personalized in 60 seconds.";

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
  manifest: "/manifest.json",
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
    "37-biomarker analysis",
    "PhenoAge biological age estimation",
    "DunedinPACE-style aging velocity",
    "12 health pattern detection",
    "8 organ-system scoring",
    "Bryan Johnson benchmark comparison",
    "Personalized supplement stack",
    "Daily wearable metric tracking",
  ],
  screenshot: `${SITE_URL}/opengraph-image`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
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
      </body>
    </html>
  );
}
