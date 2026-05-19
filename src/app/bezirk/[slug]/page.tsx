import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Map,
  Scale,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { RentHistoryChart } from "@/components/map/rent-history-chart";
import { getDistrictsGeoJSON } from "@/lib/data/districts";
import type { DistrictProperties } from "@/lib/data/districts";
import {
  BERLIN_BEZIRKE,
  bezirkNameForSlug,
} from "@/lib/slugs";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://mietcheck-map.vercel.app";

// Re-fetch once per day. Underlying data only changes after the monthly
// ingestion run; static gen at request time is overkill, but a one-day
// revalidate keeps Vercel's edge cache warm and SEO crawlers happy.
export const revalidate = 86400;

export async function generateStaticParams() {
  return BERLIN_BEZIRKE.map(({ slug }) => ({ slug }));
}

interface Params {
  slug: string;
}

const eur = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "long",
});

async function loadBezirk(slug: string): Promise<{
  name: string;
  props: DistrictProperties;
  allMedians: number[];
} | null> {
  const expectedName = bezirkNameForSlug(slug);
  if (!expectedName) return null;

  const fc = await getDistrictsGeoJSON("berlin");
  const feature = fc.features.find((f) => f.properties.name === expectedName);
  if (!feature) return null;

  const allMedians = fc.features
    .map((f) => f.properties.rent_median)
    .filter((m): m is number => m != null);

  return { name: expectedName, props: feature.properties, allMedians };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const bezirk = await loadBezirk(slug);
  if (!bezirk) {
    return { title: "Bezirk nicht gefunden · MietCheck Map" };
  }
  const { name, props } = bezirk;
  const medianText =
    props.rent_median != null
      ? `aktuell ${eur(props.rent_median)} pro m²`
      : "aktuelle Mietpreise";
  return {
    title: `Mieten in ${name} · MietCheck Map`,
    description: `Angebotsmieten in ${name} (Berlin): ${medianText} nach dem IBB Wohnungsmarktbericht. Historische Entwicklung, Quellen und rechtsverbindliche Mietspiegel-Werte.`,
    alternates: { canonical: `${SITE_URL}/bezirk/${slug}` },
    openGraph: {
      title: `Mieten in ${name}`,
      description: medianText,
      url: `${SITE_URL}/bezirk/${slug}`,
      type: "article",
    },
  };
}

export default async function BezirkPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const bezirk = await loadBezirk(slug);
  if (!bezirk) notFound();

  const { name, props, allMedians } = bezirk;
  const cityMedian =
    allMedians.length > 0
      ? allMedians.reduce((a, b) => a + b, 0) / allMedians.length
      : null;
  const deviationPct =
    cityMedian != null && props.rent_median != null && cityMedian > 0
      ? ((props.rent_median - cityMedian) / cityMedian) * 100
      : null;

  const lastUpdated = props.rent_period_end
    ? dateFmt.format(new Date(props.rent_period_end))
    : null;

  const placeSchema = {
    "@context": "https://schema.org",
    "@type": "Place",
    name,
    address: {
      "@type": "PostalAddress",
      addressLocality: name,
      addressRegion: "Berlin",
      addressCountry: "DE",
    },
    containedInPlace: {
      "@type": "City",
      name: "Berlin",
    },
    url: `${SITE_URL}/bezirk/${slug}`,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader width="6xl" />

      <script
        type="application/ld+json"
        // Static JSON, generated server-side from trusted DB values.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeSchema) }}
      />

      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <Link
          href="/karte"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3.5" />
          Zur Karte
        </Link>

        <Badge variant="outline" className="mb-4">
          <Map className="size-3" />
          Berlin · Bezirk
        </Badge>
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
          Mieten in {name}
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Aktuelle Angebotsmieten, langfristiger Trend und alle Quellen für{" "}
          {name} — Daten aus dem IBB Wohnungsmarktbericht und dem Berliner
          Mietspiegel 2024.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          <Card className="sm:col-span-2">
            <CardHeader>
              <CardDescription>Angebotsmieten-Median</CardDescription>
              <CardTitle className="text-4xl sm:text-5xl">
                {props.rent_median != null ? eur(props.rent_median) : "—"}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / m²
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                {lastUpdated ? `Stand ${lastUpdated}` : "Stand unbekannt"}
                {props.rent_sample_size != null
                  ? ` · Stichprobe n = ${props.rent_sample_size.toLocaleString(
                      "de-DE",
                    )}`
                  : ""}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Vergleich Berlin-weit</CardDescription>
              <CardTitle className="text-2xl">
                {deviationPct == null ? (
                  "—"
                ) : deviationPct >= 0 ? (
                  <span className="text-red-600 dark:text-red-400">
                    +{deviationPct.toFixed(1).replace(".", ",")} %
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {deviationPct.toFixed(1).replace(".", ",")} %
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {cityMedian != null
                  ? `gegenüber Berlin-Durchschnitt ${eur(cityMedian)} / m²`
                  : "Durchschnitt nicht berechenbar"}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {props.rent_history.length >= 2 && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                <CardTitle className="text-base">Mietpreis-Verlauf</CardTitle>
              </div>
              <CardDescription>
                Historische Angebotsmieten-Mediane für {name} aus dem IBB
                Wohnungsmarktbericht.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RentHistoryChart history={props.rent_history} />
            </CardContent>
          </Card>
        )}

        {/* Quelle */}
        {props.rent_source_name && (
          <Card className="mt-6">
            <CardHeader>
              <Badge variant="secondary" className="w-fit text-xs">
                Quelle
              </Badge>
              <CardTitle className="text-base">
                {props.rent_source_name}
              </CardTitle>
              <CardDescription>
                {props.rent_source_publisher}
                {lastUpdated ? ` · Stand ${lastUpdated}` : ""}
              </CardDescription>
            </CardHeader>
            {props.rent_source_url && (
              <CardContent>
                <a
                  href={props.rent_source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Originalquelle ansehen <ExternalLink className="size-3.5" />
                </a>
              </CardContent>
            )}
          </Card>
        )}

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <Link
            href="/check"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Scale className="size-4" />
            Eigene Miete prüfen
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/karte"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Map className="size-4" />
            Alle Bezirke auf der Karte
          </Link>
        </div>

        <div className="mt-12 border-t border-border/60 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Andere Berliner Bezirke
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {BERLIN_BEZIRKE.filter((b) => b.slug !== slug).map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/bezirk/${b.slug}`}
                  className="hover:text-foreground transition-colors"
                >
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
