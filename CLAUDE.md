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

**Ziel**: Berliner Bezirks-Geometrien + erste echte Mietspiegel-Daten in
der DB. Ingestion automatisierbar gemacht.

**Schritt 2.1 — Berliner Bezirks-Geometrien laden**
- Datenquelle: Berlin Open Data (https://daten.berlin.de) oder
   GeoBasis-DE — z.B. "Bezirke Berlin" als GeoJSON
- Script `scripts/ingest/berlin-districts.ts`: lädt GeoJSON, parst,
   inserted in `districts` mit `level='bezirk'`, `city_id='berlin'`
- Vorher in `cities` Berlin-Eintrag erstellen (centroid + bbox)
- Ausführung mit `tsx scripts/ingest/berlin-districts.ts`
- Akzeptanz: 12 Berlin-Bezirke in DB, geometry-Spalte gefüllt
- Gleiches für Ortsteile (~100) als Fein-Granularität

**Schritt 2.2 — Mietspiegel-2024-Daten ingestieren (JSON-Seed)**
- Berliner Mietspiegel 2024 manuell aus PDF in JSON umwandeln
   (Tabelle: Wohnlage × Baualter × qm-Klasse → €/qm Median+Spanne)
- Script `scripts/ingest/berlin-mietspiegel-2024.ts`
- `data_sources`-Eintrag mit korrekter URL, License, reference_date
- `rent_data_points`-Einträge pro Bezirk (Aggregation über Wohnlagen)
- Akzeptanz: ein Median-€/qm-Wert pro Berliner Bezirk in DB
- Notiz für später: PDF-Parser mit `pdf-parse` oder Claude-API für
   automatische Extraktion bei Update 2026

**Schritt 2.3 — Destatis-Trend-Daten (optional in Phase 2)**
- Destatis GENESIS-API: Verbraucherpreisindex Wohnen, monatlich
- Script `scripts/ingest/destatis-rental-index.ts`
- In `data_sources` + `rent_data_points` mit metric=
   'angebotsmiete_median_eur_per_sqm' (oder besser: Index als
   eigene neue Tabelle `rental_indices` falls relevant)

**Schritt 2.4 — Ingestion automatisierbar machen**
- GitHub Actions Workflow `.github/workflows/ingest-data.yml`
- Cron: wöchentlich, prüft auf neue Quellen
- Secrets in GitHub: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- Akzeptanz: Workflow-Run zeigt "no new data" oder ingestiert neue Werte

---

### Phase 3 — Interaktive Karte

**Ziel**: User sieht Berlin als Heatmap mit Mietpreisen pro Bezirk,
kann auf Bezirke klicken und Details sehen.

**Schritt 3.1 — Karten-Komponente**
- Neue Route `src/app/karte/page.tsx`
- Client Component mit MapLibre GL via react-map-gl
- Default-Style: kostenlos OSM-basiert (z.B. MapTiler free tier mit
   API-Key, oder rein OSM-Raster ohne Key) — Recherchieren was
   am unkompliziertesten ist
- Initial-Viewport zentriert auf Berlin (52.52°N, 13.405°E, zoom 10)

**Schritt 3.2 — Geometrien aus DB laden**
- Server Action `getDistrictsWithRents(cityId)`:
   gibt GeoJSON-FeatureCollection zurück mit Bezirks-Polygonen +
   aktuellem Median-€/qm in `properties`
- PostGIS-Abfrage: `ST_AsGeoJSON(geometry)` joined mit aktuellsten
   `rent_data_points`
- Caching-Strategie: Next.js `unstable_cache` mit Tag-basierter
   Revalidierung wenn neue Daten ingestiert werden

**Schritt 3.3 — Heatmap-Layer**
- MapLibre fill-Layer mit Choropleth:
   Farb-Stops auf Median-€/qm (z.B. 8-15 €/qm linear interpoliert)
- Legende rechts unten: Farb-Skala mit €/qm-Werten
- Hover-State: Outline + Tooltip mit Bezirksname + Wert

**Schritt 3.4 — Detail-Panel**
- Klick auf Bezirk öffnet Side-Panel (shadcn Sheet-Komponente)
- Zeigt: Bezirksname, Median-Miete, Spanne (p25-p75), letzte Aktualisierung,
   Quelle mit Link
- Mobile: vollflächiges Bottom-Sheet

**Schritt 3.5 — Stadt-Wechsel UI vorbereiten (auch wenn nur Berlin)**
- Header-Dropdown "Stadt wählen" — bereit für München/Hamburg
- Aktuell: nur "Berlin", andere disabled mit "bald"-Badge

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

**Ziel**: Historische Entwicklung pro Bezirk sichtbar machen, Detail-
Tiefe erhöhen.

**Schritt 5.1 — Historische Daten ingestieren**
- Mietspiegel 2018, 2020, 2022, 2024 — Berlin
- Quartalsdaten Amt für Statistik Berlin-Brandenburg seit 2018
- Skript `scripts/ingest/berlin-historical.ts`

**Schritt 5.2 — Trend-Chart-Komponente**
- Recharts Line-Chart mit time-series pro Bezirk
- Quellen-Tooltips: jeder Datenpunkt zeigt seine Source
- Multi-Bezirk-Vergleich (bis zu 3 Bezirke gleichzeitig)
- Route `/trends/[bezirk]` und `/trends/vergleich`

**Schritt 5.3 — SEO + Sharing**
- Pro Bezirk eigene SEO-Seite `/bezirk/[name]` mit:
   - aktueller Miete, Trend, Top-Quellen
   - Strukturierte Daten (schema.org Place)
   - OG-Image generiert
- Sitemap.xml automatisch
- robots.txt korrekt

**Schritt 5.4 — Quellen-Transparenz-Seite**
- Route `/quellen`: alle data_sources tabellarisch mit Lizenz-Info,
   reference_date, fetch_date, Link

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
2. In dieser Roadmap nachschauen, an welchem Schritt wir sind (letzter
   Commit-Message gibt meist Hinweis: "feat(phase-2.1): ...")
3. User fragen, ob diese Phase weitergeht oder Sprung an andere Stelle
4. Konkreten Schritt aus Roadmap nehmen, eigene TodoWrite-Liste daraus
   bauen, abarbeiten
5. Pro Schritt: Commit-Message Format `feat(phase-X.Y): kurze Zusammenfassung`
