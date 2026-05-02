import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Map, Scale, TrendingUp, ShieldCheck, Database, Code2 } from "lucide-react";

const features = [
  {
    icon: Map,
    title: "Interaktive Mietkarte",
    description:
      "Heatmap der durchschnittlichen Mietpreise pro Stadtteil — basierend auf qualifiziertem Mietspiegel und Marktberichten.",
  },
  {
    icon: Scale,
    title: "Fairness-Check",
    description:
      "Adresse, qm und aktuelle Miete eintragen. Sofort sehen, wie die Miete im Vergleich zum gesetzlichen Mietspiegel steht — inkl. Mietpreisbremse-Hinweis.",
  },
  {
    icon: TrendingUp,
    title: "Mietentwicklung",
    description:
      "Historische Trends pro Bezirk seit 2018, automatisch aktualisiert. Verstehen, ob die eigene Miete im Markt-Trend liegt.",
  },
];

const sources = [
  "Berliner Mietspiegel",
  "Amt für Statistik Berlin-Brandenburg",
  "BBSR Wohnungsmarktbeobachtung",
  "Destatis GENESIS-Online",
  "Geschäftsberichte Vonovia, degewo, Howoge",
  "Quartalsberichte CBRE, JLL",
  "BORIS-D Bodenrichtwerte",
  "Berlin Open Data",
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top nav */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Map className="size-5 text-primary" />
            MietCheck Map
          </div>
          <Badge variant="secondary" className="text-xs">
            in Entwicklung · v0.1
          </Badge>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center sm:text-left">
        <Badge variant="outline" className="mb-6">
          Berlin · weitere Städte folgen
        </Badge>
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight max-w-3xl">
          Wohnst du <span className="text-primary">fair</span>?
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
          Die transparente Mietkarte für Berlin: rechtsverbindliche Vergleichsmieten,
          Fairness-Check für deine eigene Wohnung und automatische Markt-Trends —
          ausschließlich aus offiziellen Quellen.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:justify-start justify-center">
          <a
            href="#features"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Mehr erfahren
          </a>
          <a
            href="https://github.com/Hendrik-srs/mietcheck-map"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border px-6 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Code2 className="size-4" />
            Source auf GitHub
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="w-full">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="w-full">
                <CardHeader>
                  <Icon className="size-6 text-primary mb-2" />
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / Datenquellen */}
      <section className="bg-muted/30 border-y border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="size-5 text-primary" />
            <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Vollständig offizielle Datenherkunft
            </span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight max-w-2xl">
            Jeder Wert quellen-belegt. Kein Scraping, kein Schattendaten.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            Alle angezeigten Mieten stammen aus rechtssicheren, frei zugänglichen
            Veröffentlichungen — automatisch aktualisiert, sobald neue Daten erscheinen.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sources.map((source) => (
              <li
                key={source}
                className="flex items-start gap-2 text-sm rounded-md border border-border/60 bg-background px-3 py-2"
              >
                <Database className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>{source}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Roadmap teaser */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight mb-6">Roadmap</h2>
        <ol className="space-y-3 text-sm">
          {[
            { state: "in Arbeit", text: "Datenpipeline für Berliner Mietspiegel & Open-Data-Quellen" },
            { state: "geplant", text: "Interaktive Karte mit Bezirks-Heatmap" },
            { state: "geplant", text: "Fairness-Check mit Mietpreisbremsen-Berechnung" },
            { state: "geplant", text: "Trend-Charts pro Bezirk seit 2018" },
            { state: "später", text: "Erweiterung auf München, Hamburg, Köln" },
          ].map((item) => (
            <li key={item.text} className="flex gap-3 items-baseline">
              <Badge
                variant={item.state === "in Arbeit" ? "default" : "outline"}
                className="shrink-0"
              >
                {item.state}
              </Badge>
              <span>{item.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>
            MietCheck Map · Open-Source-Projekt · {new Date().getFullYear()}
          </p>
          <div className="flex gap-4">
            <a
              href="https://github.com/Hendrik-srs/mietcheck-map"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex items-center gap-1"
            >
              <Code2 className="size-4" /> Source-Code
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
