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

## Status (Stand: 2026-05-05)

- **Phase 1 ✅** Setup, Schema, Landing-Page, Production-Deploy
- **Phase 2.1 ✅** Berliner Bezirks-Geometrien (Geoportal Berlin) in DB
- **Phase 2.2 ✅** Mietpreis-Daten — IBB Wohnungsmarktbericht 2025 ingestiert
- **Phase 3.1–3.4 ✅** Interaktive Karte `/karte` mit MapLibre, Heatmap-Layer,
   Klick-Sheet mit Detail-Panel
- **Phase 5.1 ✅** Historische Daten 2012–2024 ingestiert (IBB)
- **Phase 5.2 ✅** Trend-Linie im Detail-Sheet (Recharts)
- **Keep-Alive ✅** GitHub-Actions-Cron pingt täglich + commitet alle 30 Tage
   einen Heartbeat → Supabase + GitHub bleiben automatisch wach (siehe
   `.github/workflows/keep-alive.yml`)

**Was als nächstes ansteht** (in Prioritätsreihenfolge):
1. **Phase 4 — Fairness-Check** (Highlight-Feature, größter Portfolio-Wert)
2. **Phase 5.3 + 5.4** — SEO-Bezirks-Seiten + öffentliche Quellen-Seite
3. **Phase 2.1b** — Berliner Ortsteile (~100 Polygone, Voraussetzung für 4.2 Geocoding)
4. **Phase 6** — München/Hamburg/Köln
5. **Phase 3.5** — Stadt-Wechsel-UI (sobald Phase 6 läuft)

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
- **GitHub Actions**: Cron-Jobs für Daten-Ingestion (geplant) + Keep-Alive (läuft)
- **OpenFreeMap**: kostenlose Karten-Tiles ohne API-Key oder Account
- **exceljs** (statt xlsx): aktiv gepflegt, keine kritischen CVEs

## Architektur

```
src/
├── app/
│   ├── page.tsx            # Landing-Page
│   ├── karte/page.tsx      # Server Component: lädt districts via rpc
│   ├── robots.ts, sitemap.ts
├── components/
│   ├── ui/                 # shadcn (Badge, Button, Card, Input, Label, Sheet)
│   └── map/
│       ├── berlin-map.tsx        # Client wrapper, dynamic-loads inner
│       ├── berlin-map-inner.tsx  # MapLibre map + Sheet + Legend
│       └── rent-history-chart.tsx # Recharts LineChart (2012-2025)
└── lib/
    ├── data/districts.ts   # getDistrictsGeoJSON(cityId) via supabase rpc
    └── supabase/
        ├── client.ts       # Browser (RLS via publishable key)
        ├── server.ts       # SSR mit Cookies (RLS via publishable key)
        └── admin.ts        # Server-only mit secret key, BYPASSED RLS
                            # nur für Ingestion-Jobs / Admin-Endpunkte

scripts/
└── ingest/
    ├── berlin-districts.ts # Geoportal Berlin → districts.geometry
    └── berlin-ibb.ts       # IBB Wohnungsmarktbericht → rent_data_points

supabase/
└── migrations/             # SQL-Migrations chronologisch
                            # manuell via Supabase SQL Editor anwenden
                            # (Supabase CLI noch nicht eingerichtet)
                            # 0001 schema, 0002 grants, 0003 ingestion helpers,
                            # 0004 get_districts_geojson v1, 0005 rent helpers
                            # + v2, 0006 v3 mit rent_history

.github/workflows/
└── keep-alive.yml          # täglich Supabase pingen + alle 30 Tage
                            # heartbeat-commit (siehe .github/heartbeat.txt)
```

**RPC-Funktionen in Supabase** (definiert in Migrations 0003, 0005, 0006):
- `upsert_city(...)` — idempotent City-Insert mit GeoJSON bbox
- `upsert_district(...)` — idempotent District-Insert (Polygon→MultiPolygon Promotion)
- `upsert_rent_data_point(...)` — idempotent rent observation, keyed auf
   (source, district, period, metric, property_type)
- `get_districts_geojson(city_id)` — FeatureCollection mit aktuellem Median
   pro Bezirk + komplettem `rent_history` Array

## Datenbank-Schema (Phase 1)

- `cities` — Städte (Berlin first; ID = slug, mit centroid+bbox)
- `districts` — Bezirke/Ortsteile/PLZ mit MULTIPOLYGON-Geometrie (PostGIS)
- `data_sources` — Provenance-Registry: jede Datenquelle mit URL, Lizenz, Typ
- `rent_data_points` — Long-Format: pro (source × district × period × metric) eine
   Zeile. Felder: median, p25, p75, min, max, sample_size, property_type, age_range,
   size_range. Erlaubt heterogene Quellen ohne Schema-Drift.

Alle Tabellen: RLS aktiviert, public-read-Policy. Writes nur via admin-Client.

## Wichtige Konventionen / Gotchas

1. **Schema-Migrations**: chronologisch in `supabase/migrations/`. **Manuell im
   Supabase SQL Editor anwenden** — nach jedem `Write` einer Migration auf User-
   Bestätigung warten ("Success. No rows returned"). Supabase CLI ist noch nicht
   eingerichtet.
2. **Env-Variablen**: `NEXT_PUBLIC_*` darf öffentlich sein, `SUPABASE_SECRET_KEY`
   ist server-only und in Vercel separat gesetzt. Nie ins Repo. Im Worktree wird
   `.env.local` aus dem main-Repo via Symlink eingebunden.
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
6. **MapLibre flacht Properties ab**: Click-Events liefern `feature.properties`
   mit allen verschachtelten Objekten als JSON-Strings. `rent_history` muss auf
   dem Client mit `JSON.parse()` rekonstruiert werden — siehe
   `parseDistrictProperties()` in `berlin-map-inner.tsx`.
7. **Next.js 16 Caching**: `unstable_cache` ist tot, ersetzt durch `'use cache'`-
   Direktive + `cacheLife`/`cacheTag`. Wir haben das noch nicht aktiviert
   (`cacheComponents: true` in `next.config.ts`). Wenn aktiviert: alle Pages
   sind dynamic by default, `force-dynamic` ist no-op.
8. **`next/dynamic` mit `ssr: false`**: muss aus einer Client-Component kommen,
   nicht aus einem Server-Component. Pattern: `berlin-map.tsx` (use client) →
   dynamic import → `berlin-map-inner.tsx` (use client + maplibre).
9. **scripts/ vom Build-Typecheck ausgeschlossen**: in `tsconfig.json` exclude,
   weil exceljs `Buffer`-Typen mit @types/node 24 kollidieren. tsx checkt
   Scripts trotzdem zur Laufzeit.
10. **shadcn = base-ui-Variante** (nicht Radix). API ähnlich aber nicht identisch.
   Sheet wird über `<Sheet open={...} onOpenChange={...}>` controlled.
11. **Ingestion-Scripts sind idempotent**: Re-runs überschreiben in place.
    Sicher, beliebig oft auszuführen.

## Befehle

```bash
npm run dev                       # Dev-Server mit Turbopack, http://localhost:3000
npm run build                     # Production-Build (lokal verifizieren vor Push)
npm run lint                      # ESLint
npm run start                     # Production-Server (lokal nach build)

# Ingestion (idempotent, brauchen .env.local mit SUPABASE_SECRET_KEY)
npm run ingest:berlin-districts   # Geoportal Berlin → 12 Bezirke
npm run ingest:berlin-ibb         # IBB Wohnungsmarktbericht → 168 rent points
```

Deployment passiert automatisch bei jedem `git push origin main`.
Push-Workflow: User arbeitet auf einem Worktree-Branch, Push geht via
`git push origin HEAD:main` direkt nach main. Kein PR-Step.

## Style-Vorgaben

- Sprache: Deutsch in UI-Texten, English in Code-Kommentaren und Commit-Messages
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`)
- Komponenten: Functional, mit TypeScript-Props. Server Components default, nur
   bei Bedarf `"use client"`.
- Icons: lucide-react (Achtung: `Github`-Icon existiert nicht in v1.x — ist
   wegen Markenrecht raus; stattdessen `Code2` oder Inline-SVG).

## Detaillierte Roadmap

Bei jedem Session-Start: erst `git status` + `git log -5` checken, dann
sehen, an welchem Phase-Schritt wir gerade stehen. Pro Schritt: ein Commit
+ Deploy + visuelle Verifikation mit dem User.

---

### Phase 1 — Setup & Foundation ✅ DONE

- [x] Next.js 16 + TS + Tailwind v4 + shadcn/ui Setup
- [x] Supabase-Projekt (Frankfurt, neue API-Keys), PostGIS aktiviert
- [x] Initial-Schema: cities, districts, data_sources, rent_data_points + RLS
- [x] Supabase-Clients: browser, server, admin
- [x] Polierte Landing-Page mit Pitch, Features, Datenquellen, Roadmap
- [x] GitHub-Repo + Vercel-Auto-Deploy + Live unter mietcheck-map.vercel.app
- [x] gh CLI + PATH gefixt, brew shellenv in zshrc
- [x] CLAUDE.md mit Projekt-Kontext

---

### Phase 2 — Datenpipeline & erste Daten in der DB

**Schritt 2.1 ✅ DONE** — Berliner Bezirks-Geometrien
- Quelle: Geoportal Berlin via TSB (CC-BY-equivalent, Attribution-Pflicht)
- Script: `npm run ingest:berlin-districts`
- 12 Bezirke als MULTIPOLYGON in `districts` (Commit `5e76978`)

**Schritt 2.1b — Berliner Ortsteile (NICHT GEMACHT)**
- ~100 feinere Polygone, gleiche Pipeline, andere GeoJSON-URL
- Erst nötig für Phase 4.2 (Adress-Geocoding zu Bezirk via ST_Contains)

**Schritt 2.2 ✅ DONE** — Angebotsmieten
- **Quelle gewechselt**: nicht Mietspiegel 2024 (Wohnlage×Baualter×qm-Tabelle,
   schwierig pro-Bezirk zu aggregieren), sondern **IBB Wohnungsmarktbericht 2025**
   (CC-BY-4.0, XLSX direkt downloadbar mit ein Median pro Bezirk pro Jahr)
- Script: `npm run ingest:berlin-ibb`  (parsed alle Jahre 2012–2025)
- `data_sources.id = 'ibb_wohnungsmarktbericht_2025'`
- `rent_data_points`: 168 Zeilen, metric `angebotsmiete_median_eur_per_sqm`
- Range 2025: 11,56 €/m² (Marzahn-Hellersdorf) – 20,00 €/m² (Mitte)
- Mietspiegel 2024 als alternative Quelle für Bestandsmieten **noch offen** —
   wäre interessant für direkte Mietpreisbremsen-Logik in Phase 4

**Schritt 2.3 — Destatis-Trend-Daten (NICHT GEMACHT, optional)**
- Destatis GENESIS-API: Verbraucherpreisindex Wohnen, monatlich
- Aktuell brauchen wir's nicht weil IBB-Historie 2012–2025 alles liefert

**Schritt 2.4 — Auto-Ingestion (NICHT GEMACHT)**
- GitHub Actions Workflow für automatische Re-Ingestion
- Aktuell: manuell `npm run ingest:berlin-ibb` einmal pro Jahr nach IBB-Update
- Existierender Workflow `keep-alive.yml` ist NUR für Aktivität, nicht Ingestion

---

### Phase 3 — Interaktive Karte

**Schritt 3.1 ✅** Karten-Komponente — `/karte` mit MapLibre via react-map-gl@8,
Style: OpenFreeMap Positron (gratis, kein Key)

**Schritt 3.2 ✅** Geometrien + Mieten aus DB — Server Component holt
GeoJSON via rpc `get_districts_geojson('berlin')`. Caching via Next.js
'use cache' bewusst noch NICHT aktiviert.

**Schritt 3.3 ✅** Heatmap-Layer — Choropleth (Yellow→Red), Legende mit
Live-Range bottom-right

**Schritt 3.4 ✅** Detail-Panel — shadcn Sheet, zeigt Median + Sample Size
+ Trend-Chart + Quelle. Mobile-responsive (Sheet macht das automatisch).
**Noch offen aus Roadmap**: p25/p75-Spanne (IBB liefert keine), Mobile-Bottom-Sheet
(aktuell rechts-gleitend auch auf Mobile)

**Schritt 3.5 — Stadt-Wechsel UI (NICHT GEMACHT)** — kommt mit Phase 6

---

### Phase 4 — Fairness-Check (das Highlight-Feature)

**Ziel**: User trägt Adresse + qm + Miete ein, bekommt Mietpreisbremsen-
Bewertung. Hauptdifferenzierer gegenüber Konkurrenz.

**Schritt 4.1 — Eingabe-Formular**
- Route `/check` mit Form:
   - Adresse (Straße + Hausnummer + PLZ + Stadt)
   - Wohnungsgröße in qm
   - Aktuelle Kaltmiete €/Monat
   - Optional: Baujahr, Wohnlage-Selbsteinschätzung
- Validierung mit Zod
- shadcn Form-Komponenten

**Schritt 4.2 — Adress-Geocoding**
- Free-Tier-Geocoder: Nominatim (OSM) oder Photon
- Server Action `geocodeAddress(query)` → `{lat, lng}`
- Mit PostGIS `ST_Contains` rausfinden welcher Bezirk

**Schritt 4.3 — Vergleichsmiete & Bewertung**
- Server-Logik: relevanter Mietspiegel-Wert für (Bezirk × Baualter ×
   Wohnungsgröße) raussuchen
- Berechnung:
   - Abweichung in %
   - Mietpreisbremse-Limit (10% über ortsüblicher Vergleichsmiete bei
     Neuvermietung, plus Ausnahmen für Neubau ab 2014, modernisierte
     Wohnungen, vorherige hohe Miete)
   - Konkrete Rückforderungs-Schätzung (€/Monat überzahlt × Monate)
- WICHTIGER DISCLAIMER im UI: "keine Rechtsberatung, Beispielrechnung"

**Schritt 4.4 — Ergebnis-Seite**
- Visuell stark: großer Verdict ("Du zahlst 12% über dem Mietspiegel"),
   Skala mit deinem Punkt drauf
- Aktionen: Ergebnis als PDF, Link zum Mieterverein, FAQ
- Share-fähig: OG-Image generieren mit Next.js OG, ohne PII

**Schritt 4.5 — Anonymisiert in der Datenbank speichern**
- Tabelle `crowdsourced_rents` (neue Migration)
- Felder: district_id, sqm, monthly_rent, building_age_bracket,
   submitted_at — KEINE Adresse, keine Email, keine User-ID
- DSGVO-Hinweis im Form
- Neue Datenpunkte erscheinen nach Moderation in der Karte

---

### Phase 5 — Trend-Charts & Polish

**Schritt 5.1 ✅** Historie 2012–2025 ingestiert via IBB
(168 rent_data_points)

**Schritt 5.2 ✅** Trend-Chart in Sheet — Recharts LineChart + %-Indikator
relativ zu 2012. **Noch offen aus Roadmap**: separate Routen
`/trends/[bezirk]` und `/trends/vergleich` für Multi-Bezirk-Vergleich

**Schritt 5.3 — SEO-Bezirks-Seiten (NICHT GEMACHT)**
- Pro Bezirk eigene SEO-Seite `/bezirk/[name]`
- Strukturierte Daten (schema.org Place), OG-Image
- robots.txt + sitemap.xml schon da, aber müssten Bezirks-Seiten enthalten

**Schritt 5.4 — Quellen-Transparenz-Seite (NICHT GEMACHT)**
- Route `/quellen`: alle `data_sources` tabellarisch mit Lizenz, Datum, Link
- Aktuell ist die Quellenangabe nur im Detail-Sheet pro Bezirk sichtbar

---

### Phase 6 — Multi-City-Erweiterung

**Ziel**: München, Hamburg, Köln dazu.

- Pro Stadt: Geometrien + Mietspiegel + lokale Statistik-Quellen
- Stadt-Auswahl im Header funktional machen
- City-spezifische Routen `/karte?stadt=muenchen`
- Lessons-Learned: pro Stadt 1-2 Tage Aufwand wenn Pipeline steht

---

### Phase 7 (optional, falls wir weiter machen) — Monetarisierung

**Ideen, in Reihenfolge der Realisierbarkeit:**
1. **Premium-PDF-Report** für Mieter — detaillierte Bewertung,
   Senkungs-Anspruch-Berechnung, Anwalts-Vorlage. 5-15€ Stripe.
2. **Affiliate**: Mieterverein-Mitgliedschaften, Mietrechts-Anwälte
3. **API-Access**: für Journalisten, Forscher, Maklern. Tiered Pricing.
4. **White-Label** für Wohnungsbau-Genossenschaften

Vor Monetarisierung: Impressum, Datenschutzerklärung, AGB pflegen.
Anwalts-Konsultation für Mietpreisbremsen-Berechnung empfehlenswert
(damit der Disclaimer stark genug ist).

---

## Was beim Session-Start zu tun ist

1. `git status` + `git log -10` zur Orientierung
2. **Status-Sektion oben in dieser Datei** zeigt was live ist und was als
   nächstes ansteht. Letzter Commit-Message gibt zusätzlichen Hinweis.
3. User fragen, ob die Top-Priorität aus der Status-Liste angegangen wird
   oder Sprung an andere Stelle
4. Konkreten Schritt aus Roadmap nehmen, eigene TodoWrite-Liste daraus
   bauen, abarbeiten
5. Pro Schritt: Commit-Message Format `feat(phase-X.Y): kurze Zusammenfassung`,
   dann `git push origin HEAD:main` (kein PR-Step)
6. Vor jedem `Write` einer Migration auf User-Bestätigung warten ("Success.
   No rows returned"), dann erst weitermachen
