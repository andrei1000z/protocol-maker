import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const inter = Inter({ variable: "--font-geist-sans", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Protocol — AI Longevity Engine",
  description: "Your blood work. AI analysis. A longevity protocol built for YOU — not Bryan Johnson. 37 biomarkers, 12 health patterns, personalized in 60 seconds.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Protocol" },
  openGraph: {
    title: "Protocol — AI Longevity Engine",
    description: "Get a personalized longevity protocol calibrated to YOUR biomarkers. 37 markers analyzed, 12 patterns detected, protocol in 60 seconds.",
    type: "website",
    siteName: "Protocol",
  },
  twitter: {
    card: "summary_large_image",
    title: "Protocol — AI Longevity Engine",
    description: "Bryan Johnson spends $2M/year on longevity. You have your blood panel and AI.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh bg-background text-foreground">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
