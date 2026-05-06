"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runFairnessCheck, type CheckFormState } from "./actions";
import type { Verdict } from "@/lib/data/fairness";

const initialState: CheckFormState = { status: "idle" };

const eur = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

const eur2 = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);

const pct = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toLocaleString("de-DE", {
    maximumFractionDigits: 1,
  })} %`;

const verdictStyle: Record<
  Verdict,
  { ring: string; bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  guenstig: {
    ring: "ring-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  marktueblich: {
    ring: "ring-sky-500/40",
    bg: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-400",
    Icon: Info,
  },
  ueber_markt: {
    ring: "ring-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  weit_ueber_markt: {
    ring: "ring-destructive/40",
    bg: "bg-destructive/10",
    text: "text-destructive",
    Icon: AlertCircle,
  },
};

export function CheckForm() {
  const [state, formAction, pending] = useActionState(runFairnessCheck, initialState);

  if (state.status === "success" && state.result) {
    return <ResultPanel state={state} />;
  }

  const v = state.values ?? { address: "", sizeSqm: "", monthlyRent: "" };
  const e = state.errors ?? {};

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">Fairness-Check</CardTitle>
        <CardDescription>
          Adresse, Wohnfläche und Kaltmiete eintragen. Wir vergleichen mit dem aktuellen
          Angebotsmieten-Median deines Bezirks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="address">Adresse in Berlin</Label>
            <Input
              id="address"
              name="address"
              required
              autoComplete="street-address"
              placeholder="Sonnenallee 100, 12045 Berlin"
              defaultValue={v.address}
              aria-invalid={Boolean(e.address) || undefined}
            />
            {e.address ? (
              <p className="text-sm text-destructive">{e.address}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Straße + Hausnummer + PLZ. Wir verarbeiten die Adresse nur für den Vergleich,
                speichern sie nicht.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sizeSqm">Wohnfläche (m²)</Label>
              <Input
                id="sizeSqm"
                name="sizeSqm"
                type="number"
                min="6"
                max="999"
                step="0.5"
                required
                placeholder="62"
                defaultValue={v.sizeSqm}
                aria-invalid={Boolean(e.sizeSqm) || undefined}
              />
              {e.sizeSqm && <p className="text-sm text-destructive">{e.sizeSqm}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="monthlyRent">Kaltmiete (€/Monat)</Label>
              <Input
                id="monthlyRent"
                name="monthlyRent"
                type="number"
                min="51"
                max="19999"
                step="1"
                required
                placeholder="850"
                defaultValue={v.monthlyRent}
                aria-invalid={Boolean(e.monthlyRent) || undefined}
              />
              {e.monthlyRent && <p className="text-sm text-destructive">{e.monthlyRent}</p>}
            </div>
          </div>

          {e._form && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {e._form}
            </div>
          )}

          <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-fit">
            {pending ? "Prüfe…" : "Miete prüfen"}
            <ArrowRight />
          </Button>

          <p className="text-xs text-muted-foreground">
            Hinweis: Dieser Vergleich nutzt den IBB-Angebotsmieten-Median. Er ersetzt keine
            Rechtsberatung und keine Mietspiegel-konforme Mietpreisbremsen-Berechnung.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function ResultPanel({ state }: { state: CheckFormState }) {
  if (!state.result) return null;
  const { address, displayName, sizeSqm, monthlyRent, district, assessment } = state.result;
  const style = verdictStyle[assessment.verdict];

  return (
    <div className="grid gap-6">
      {/* Verdict */}
      <Card className={`w-full ring-2 ${style.ring}`}>
        <CardHeader>
          <div className={`flex items-center gap-2 ${style.text}`}>
            <style.Icon className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {assessment.verdictLabel}
            </span>
          </div>
          <CardTitle className="text-3xl sm:text-4xl">
            Du zahlst{" "}
            <span className={style.text}>{pct(assessment.deviationPct)}</span>
            <br className="sm:hidden" /> gegenüber dem Markt-Median.
          </CardTitle>
          <CardDescription className="text-base">
            {assessment.verdictDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`rounded-lg ${style.bg} px-4 py-3 text-sm`}>
            <strong>{eur2(assessment.pricePerSqm)} / m²</strong> deine Miete{" "}
            vs. <strong>{eur2(assessment.comparisonMedian)} / m²</strong> Bezirks-Median in{" "}
            <strong>{district.districtName}</strong>.
            {assessment.monthlyOverpay > 0 && (
              <>
                <br />
                Differenz: ca. <strong>{eur(assessment.monthlyOverpay)}</strong> pro Monat /{" "}
                <strong>{eur(assessment.yearlyOverpay)}</strong> pro Jahr über dem Median.
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details deiner Eingabe</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Adresse" value={address} note={displayName} />
          <Row label="Bezirk" value={district.districtName} />
          <Row label="Wohnfläche" value={`${sizeSqm.toLocaleString("de-DE")} m²`} />
          <Row label="Kaltmiete" value={eur(monthlyRent)} />
          <Row label="Preis pro m²" value={eur2(assessment.pricePerSqm)} />
        </CardContent>
      </Card>

      {/* Source */}
      {district.rentSourceUrl && district.rentSourceName && (
        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit text-xs">
              Quelle
            </Badge>
            <CardTitle className="text-base">{district.rentSourceName}</CardTitle>
            <CardDescription>
              {district.rentSourcePublisher}
              {district.rentPeriodEnd && (
                <> · Stand {new Date(district.rentPeriodEnd).getFullYear()}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href={district.rentSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Originalquelle ansehen <ExternalLink className="size-3.5" />
            </a>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Disclaimer:</strong> Diese Bewertung vergleicht
        deine Miete mit dem aktuellen Angebotsmieten-Median des Bezirks (IBB
        Wohnungsmarktbericht 2025). Der gesetzliche Mietspiegel kann andere Werte ergeben,
        insbesondere unter Berücksichtigung von Baualter, Wohnlage und Modernisierungs-Stand.
        Für eine rechtssichere Mietpreisbremsen-Prüfung wende dich an einen Mieterverein oder
        eine:n Fachanwält:in für Mietrecht.
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/check" className={buttonVariants({ variant: "outline", size: "lg" })}>
          <RotateCcw />
          Neue Prüfung
        </Link>
        <Link href="/karte" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Zur Karte
          <ArrowRight />
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 sm:grid-cols-[160px_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span>
        <span className="font-medium">{value}</span>
        {note && <span className="block text-xs text-muted-foreground mt-0.5">{note}</span>}
      </span>
    </div>
  );
}
