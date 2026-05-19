import Link from "next/link";
import { ExternalLink, ShieldCheck, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { getAllDataSources, SOURCE_TYPE_LABELS, type DataSource } from "@/lib/data/sources";

export const metadata = {
  title: "Quellen · MietCheck Map",
  description:
    "Alle Datenquellen der MietCheck Map mit Lizenz, Stand und Original-Link. 100 % offizielle, frei zugängliche Veröffentlichungen — kein Scraping.",
};

// Refresh once a day in production; the underlying data_sources table only
// changes when we register a new ingestion run.
export const revalidate = 86400;

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : dateFmt.format(d);
}

function groupByType(sources: DataSource[]) {
  const map = new Map<string, DataSource[]>();
  for (const s of sources) {
    const list = map.get(s.source_type) ?? [];
    list.push(s);
    map.set(s.source_type, list);
  }
  return Array.from(map.entries());
}

export default async function QuellenPage() {
  const sources = await getAllDataSources();
  const groups = groupByType(sources);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader width="6xl" />

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10">
          <Badge variant="outline" className="mb-4">
            <ShieldCheck className="size-3" />
            Transparenz
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Datenquellen
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            Jeder Wert auf MietCheck Map kommt aus einer offiziellen, frei zugänglichen
            Quelle. Wir scrapen nichts und sammeln keine Daten hinter Login-Wänden.
            Diese Seite listet jede Quelle, ihre Lizenz und das exakte Bezugsdatum.
          </p>
        </div>

        {sources.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Noch keine Quellen erfasst</CardTitle>
              <CardDescription>
                Sobald die erste Ingestion gelaufen ist, erscheinen hier alle
                registrierten Datenquellen.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-8">
            {groups.map(([type, items]) => (
              <section key={type}>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {SOURCE_TYPE_LABELS[type as keyof typeof SOURCE_TYPE_LABELS] ?? type}
                </h2>
                <div className="grid gap-3">
                  {items.map((s) => (
                    <SourceCard key={s.id} source={s} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-lg border border-border/60 bg-muted/30 p-5 text-sm text-muted-foreground">
          <strong className="text-foreground inline-flex items-center gap-1">
            <FileText className="size-4" />
            Lizenzen
          </strong>
          <p className="mt-2">
            Wir respektieren die jeweilige Lizenz jeder Quelle. Open-Data-Lizenzen
            wie <code className="text-foreground">dl-de-zero-2.0</code> und
            amtliche Werke nach <code className="text-foreground">§ 5 UrhG</code>{" "}
            (Gemeinfreiheit) erlauben freie Nutzung. Bei kommerziell lizenzierten
            Quellen verwenden wir nur die Werte, die unter Wahrnehmung der
            Bibliotheks-/Zitatschranken zulässig sind.
          </p>
        </div>

        <div className="mt-10">
          <Link
            href="/karte"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Zurück zur Karte
          </Link>
        </div>
      </main>
    </div>
  );
}

function SourceCard({ source }: { source: DataSource }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base leading-snug">{source.name}</CardTitle>
            <CardDescription className="mt-1">{source.publisher}</CardDescription>
          </div>
          {source.reference_date && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              Stand {formatDate(source.reference_date)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {source.license && (
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Lizenz:</span>{" "}
            {source.license}
          </div>
        )}
        {source.notes && (
          <p className="text-muted-foreground">{source.notes}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
          <span>
            Zuletzt ingestiert: {formatDate(source.fetched_at)}
          </span>
          {source.source_url && (
            <a
              href={source.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Originalquelle <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
