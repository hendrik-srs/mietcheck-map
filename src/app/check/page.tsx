import Link from "next/link";
import { Map, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CheckForm } from "./check-form";

export const metadata = {
  title: "Fairness-Check · MietCheck Map",
  description:
    "Prüfe, wie deine Berliner Miete im Vergleich zum offiziellen Angebotsmieten-Median deines Bezirks steht. 100 % offizielle Quellen, kein Login.",
};

export default function CheckPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Map className="size-5 text-primary" />
            MietCheck Map
          </Link>
          <Link
            href="/karte"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Karte
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="mb-8">
          <Badge variant="outline" className="mb-4">
            <Scale className="size-3" />
            Berlin
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Wohnst du <span className="text-primary">fair</span>?
          </h1>
          <p className="mt-3 text-muted-foreground">
            Trag deine Adresse, Wohnfläche und Kaltmiete ein. Wir vergleichen mit dem
            offiziellen Angebotsmieten-Median deines Bezirks aus dem IBB
            Wohnungsmarktbericht 2025.
          </p>
        </div>

        <CheckForm />
      </main>
    </div>
  );
}
