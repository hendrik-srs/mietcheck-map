import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MietCheck Map — Mietspiegel & Fairness-Check für Berlin",
  description:
    "Die transparente Mietkarte für Deutschland: rechtsverbindliche Vergleichsmieten, Fairness-Check und Trends — basierend auf offiziellen Quellen.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mietcheck-map.vercel.app",
  ),
  openGraph: {
    title: "MietCheck Map",
    description:
      "Transparente Mietpreis-Karte mit Fairness-Check — rein offizielle Datenquellen.",
    locale: "de_DE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
