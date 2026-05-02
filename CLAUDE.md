@AGENTS.md

# MietCheck Map — Projekt-Kontext für Claude

## Worum es geht

Open-Source-Mietpreis-Karte für Deutschland mit Fairness-Check. USP gegenüber
ImmoScout/immowelt-Maps: **ausschließlich offizielle, frei zugängliche Quellen**
(Mietspiegel, Destatis, BBSR, Geschäftsberichte öffentlicher Wohnungsbaugesellschaften,
Marktberichte CBRE/JLL, BORIS-D, Open Data der Länder). Kein Scraping. Jeder
Datenpunkt mit Quelle verlinkt.

Ziel: portfolio-taugliches Projekt für CV/LinkedIn, später potenziell monetarisierbar
(Premium-Reports, Mietpreisbremse-Beratung-Affiliate, etc.).

## Status

- **Phase 1 ✅ abgeschlossen**: Setup, Schema, Landing-Page, Production-Deploy
- **Phase 2 🔜 als nächstes**: Berliner Bezirks-Geometrien laden, Mietspiegel-Daten
   ingestieren, erste interaktive Karte mit Heatmap rendern
- Phase 3+: Fairness-Check (Mietpreisbremse-Berechnung), Trend-Charts pro Bezirk,
   später Erweiterung auf München/Hamburg/Köln

Live: https://mietcheck-map.vercel.app
Repo: https://github.com/Hendrik-srs/mietcheck-map

## Tech-Stack-Entscheidungen (warum so)

- **Next.js 16 (App Router) + TypeScript**: meistgefragter DE-Stack 2026, gut für CV
- **Tailwind CSS v4 + shadcn/ui**: schnelle, professionelle UI ohne Designer
- **Supabase (Postgres + PostGIS)**: Auth + DB + Storage in einem, RLS für Security,
   Frankfurt-Region für DSGVO. PostGIS für Geo-Queries (Heatmaps, Proximity)
- **MapLibre GL JS** (über react-map-gl@8): Open Source, keine Mapbox-Token-Kosten
- **Recharts**: Trend-Charts
- **Vercel**: Free-Tier-Hosting, Auto-Deploy bei jedem Push, Preview-URLs für Branches
- **GitHub Actions** (geplant Phase 2+): Cron-Jobs für Daten-Ingestion

## Architektur

```
src/
├── app/                    # Next.js App Router
├── components/ui/          # shadcn/ui (Card, Button, Input, Label, Badge)
└── lib/
    └── supabase/
        ├── client.ts       # Browser (RLS via publishable key)
        ├── server.ts       # SSR mit Cookies (RLS via publishable key)
        └── admin.ts        # Server-only mit secret key, BYPASSED RLS
                            # nur für Ingestion-Jobs / Admin-Endpunkte
supabase/
└── migrations/             # SQL-Migrations chronologisch
                            # manuell via Supabase SQL Editor anwenden
                            # (Supabase CLI noch nicht eingerichtet)
```

## Datenbank-Schema (Phase 1)

- `cities` — Städte (Berlin first; ID = slug, mit centroid+bbox)
- `districts` — Bezirke/Ortsteile/PLZ mit MULTIPOLYGON-Geometrie (PostGIS)
- `data_sources` — Provenance-Registry: jede Datenquelle mit URL, Lizenz, Typ
- `rent_data_points` — Long-Format: pro (source × district × period × metric) eine
   Zeile. Felder: median, p25, p75, min, max, sample_size, property_type, age_range,
   size_range. Erlaubt heterogene Quellen ohne Schema-Drift.

Alle Tabellen: RLS aktiviert, public-read-Policy. Writes nur via admin-Client.

## Wichtige Konventionen / Gotchas

1. **Schema-Migrations**: chronologisch in `supabase/migrations/`. Manuell im
   Supabase SQL Editor anwenden. (Wenn wir die Supabase CLI später einrichten,
   gibt's `supabase db push`.)
2. **Env-Variablen**: `NEXT_PUBLIC_*` darf öffentlich sein, `SUPABASE_SECRET_KEY`
   ist server-only und in Vercel separat gesetzt. Nie ins Repo.
3. **Daten-Quellen-Regel**: Nichts scrapen. Wenn Daten nur durch Scraping
   verfügbar sind, eine andere Quelle suchen oder diesen Datenpunkt weglassen.
   Im UI immer Quelle + Lizenz verlinken.
4. **Rechtliches**: Mietspiegel sind nach §558d BGB öffentlich. Geschäftsberichte
   öffentlicher AGs sind Pflichtveröffentlichungen. CBRE/JLL/immowelt-Marktberichte
   werden von ihnen selbst publiziert (Marketing-PDFs) — Parsen davon ist legal.
5. **Layout-Bug-History**: `mx-auto + max-w-6xl + grid` auf demselben Element +
   Flex-Parent → manche Browser kollabieren das auf min-content. **Pattern:**
   max-width auf Wrapper-Div, grid auf innerem Element. Siehe Features-Section
   in `src/app/page.tsx` als Referenz.

## Befehle

```bash
npm run dev      # Dev-Server mit Turbopack, http://localhost:3000
npm run build    # Production-Build (lokal verifizieren vor Push)
npm run lint     # ESLint
npm run start    # Production-Server (lokal nach build)
```

Deployment passiert automatisch bei jedem `git push origin main`.

## Style-Vorgaben

- Sprache: Deutsch in UI-Texten, English in Code-Kommentaren und Commit-Messages
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`)
- Komponenten: Functional, mit TypeScript-Props. Server Components default, nur
   bei Bedarf `"use client"`.
- Icons: lucide-react (Achtung: `Github`-Icon existiert nicht in v1.x — ist
   wegen Markenrecht raus; stattdessen `Code2` oder Inline-SVG).

## Was beim nächsten Session-Start hilfreich wäre

1. User sagt vermutlich "weitermachen mit Phase 2"
2. Erst kurz `git status` + `git log -5` checken um zu sehen, ob seither was passiert ist
3. Dann konkret einsteigen mit:
   - **Schritt 2.1**: Berliner Bezirks-Geometrien aus Berlin Open Data
     (https://daten.berlin.de) als GeoJSON laden, in `districts`-Tabelle
     ingestieren via Server-Script (`scripts/ingest/berlin-districts.ts`)
   - **Schritt 2.2**: Mietspiegel-2024-Daten als JSON-Seed (manuell aus PDF
     extrahiert, später automatisierbar) ingestieren
   - **Schritt 2.3**: `/karte`-Route mit MapLibre + Heatmap-Layer
4. Pro Schritt einen Commit, deployen, gemeinsam visuell verifizieren
