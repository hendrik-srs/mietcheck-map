# MietCheck Map — Build Explanation (fertige Features)

> Was wurde gebaut, wie ist es technisch umgesetzt, warum diese Lösung.
> Offene Phasen → siehe [ROADMAP.md](ROADMAP.md).
> Aktueller Top-Stand → siehe [`../CLAUDE.md`](../CLAUDE.md).

---

## Tech-Stack-Entscheidungen (übergreifend)

| Wahl | Warum |
|---|---|
| **Next.js 16 (App Router) + TypeScript** | Meistgefragter DE-Stack 2026, gut fürs Portfolio/CV. Server Components reduzieren Client-Bundle. |
| **Tailwind CSS v4 + shadcn/ui** | Schnelle, professionelle UI ohne Designer. shadcn-Variante = base-ui (nicht Radix). |
| **Supabase (Postgres + PostGIS)** | Auth + DB + Storage in einem, RLS für Security, Frankfurt-Region für DSGVO. PostGIS für Geo-Queries (Heatmaps, Proximity). |
| **MapLibre GL JS** (via react-map-gl@8) | Open Source, keine Mapbox-Token-Kosten. |
| **OpenFreeMap** (Tiles) | Kostenlos, kein API-Key, kein Account, keine Limits — der einzige Tile-Provider mit dieser Kombi. Verworfen: MapTiler (verlangt Account+Key). |
| **Recharts** | De-facto-Standard für Charts in React, schlanke API. |
| **Vercel** | Free-Tier-Hosting, Auto-Deploy bei jedem Push, Preview-URLs. Backup-Plan: Cloudflare Pages (kein "non-commercial"-Constraint). |
| **GitHub Actions** | Cron-Jobs für Keep-Alive (läuft) + zukünftig Daten-Ingestion. |
| **exceljs** (statt SheetJS/xlsx) | xlsx hat ungefixte high-severity Vulns (ReDoS, Prototype Pollution). exceljs hat nur eine moderate via uuid — akzeptabel für Script-only Dependency. |
| **Push direkt nach `main`** (kein PR) | Solo-Builder, direkter Deploy-Flow gewünscht. PR-Step käme erst mit externen Mitwirkenden. |
| **Migrations manuell im Supabase SQL Editor** | Supabase CLI absichtlich noch nicht eingerichtet. Workflow: Migration schreiben → User kopiert in Editor → "Success. No rows returned" → weitermachen. |

---

## Phase 1 — Setup & Foundation ✅

**Was**
- Next.js 16 + TS + Tailwind v4 + shadcn/ui Bootstrapping
- Supabase-Projekt (Frankfurt, neue API-Keys), PostGIS aktiviert
- Initial-Schema: `cities`, `districts`, `data_sources`, `rent_data_points` mit RLS
- Drei Supabase-Clients: `browser`, `server`, `admin`
- Polierte Landing-Page mit Pitch, Features, Datenquellen, Roadmap
- GitHub-Repo + Vercel-Auto-Deploy + Live unter mietcheck-map.vercel.app
- gh CLI + PATH gefixt, brew shellenv in zshrc

**Wie**
- Schema in [`supabase/migrations/20260502_0001_initial_schema.sql`](../supabase/migrations/20260502_0001_initial_schema.sql).
  Long-Format für `rent_data_points`: pro (source × district × period × metric) eine
  Zeile mit median/p25/p75/min/max/sample_size/property_type/age_range/size_range.
  Erlaubt heterogene Quellen ohne Schema-Drift.
- Drei Client-Patterns: `browser` (RLS via publishable key), `server` (SSR mit Cookies),
  `admin` (Server-only mit secret key, BYPASSED RLS — nur Ingestion).
- RLS aktiviert auf allen Tabellen, public-read-Policy, Writes nur via admin.

**Warum**
- Long-Format-Schema lebt mit verschiedenen Quellen mit (Mietspiegel, IBB, Destatis,
  Marktberichte). Ein Wide-Schema müsste pro neuer Quelle erweitert werden.
- Drei Clients statt einem: erzwingt explizite Wahl pro Code-Pfad, verhindert
  versehentliche Secret-Key-Lecks ins Frontend.

---

## Phase 2.1 — Berliner Bezirks-Geometrien ✅

**Was**
- 12 Berliner Bezirke als `MULTIPOLYGON` in `districts`-Tabelle
- Idempotentes Ingestion-Script (`npm run ingest:berlin-districts`)

**Wie**
- Quelle: Geoportal Berlin via TSB (CC-BY-equivalent, Attribution-Pflicht)
- Script: [`scripts/ingest/berlin-districts.ts`](../scripts/ingest/berlin-districts.ts)
  fetched GeoJSON, ruft pro Feature die RPC `upsert_district(...)` auf
- RPC promoviert Polygon → MultiPolygon mit `ST_Multi`, damit das Spalten-Type
  einheitlich bleibt
- Index auf `geometry` (GIST) + `city_id` für schnelle Lookups

**Warum**
- Geoportal Berlin: rechtssichere offizielle Quelle, klare Lizenz.
- `MULTIPOLYGON` als Spalten-Type: einige Bezirke (z. B. Spandau mit Inseln im
  Wannsee-Bereich) sind multipolygonal. Einheitlicher Type vereinfacht Queries.

---

## Phase 2.2 — IBB Wohnungsmarktbericht 2025 ✅

**Was**
- 168 `rent_data_points` (12 Bezirke × 14 Jahre 2012–2025)
- Metric: `angebotsmiete_median_eur_per_sqm`
- Range 2025: 11,56 €/m² (Marzahn-Hellersdorf) – 20,00 €/m² (Mitte)

**Wie**
- Quelle: IBB Wohnungsmarktbericht 2025 (CC-BY-4.0), XLSX direkt downloadbar
- Script: [`scripts/ingest/berlin-ibb.ts`](../scripts/ingest/berlin-ibb.ts) parsed mit
  `exceljs` alle Jahre 2012–2025
- Idempotenz via RPC `upsert_rent_data_point(...)` mit Key
  `(source, district, period, metric, property_type)` — re-runs überschreiben in place
- `data_sources.id = 'ibb_wohnungsmarktbericht_2025'` mit Quellen-URL und Lizenz

**Warum (Quelle gewechselt!)**
- Ursprünglich war der Berliner Mietspiegel 2024 als Quelle vorgesehen. **Verworfen**,
  weil die Tabelle Wohnlage × Baualter × Größe statt pro-Bezirk strukturiert ist —
  schwer zu aggregieren ohne eigene Annahmen.
- IBB liefert direkt einen Median pro Bezirk pro Jahr. Außerdem: kostenlose XLSX,
  klare Lizenz, jährliches Update.
- Mietspiegel bleibt aber relevant für Phase 4 (Mietpreisbremse braucht offizielle
  Vergleichsmiete) → Phase 2.2b.

---

## Phase 3.1–3.4 — Interaktive Karte `/karte` ✅

**Was**
- Route `/karte` mit MapLibre-Karte, Heatmap-Choropleth, Klick-Sheet mit Detail-Panel,
  Legende mit Live-Range
- Mobile-responsive (Sheet macht das automatisch)

**Wie**
- Server Component lädt GeoJSON via RPC `get_districts_geojson('berlin')` —
  alles in einem Round-Trip (Geometrien + aktueller Median + Quellen-Metadaten +
  vollständiges `rent_history`-Array pro Feature)
- Client-Wrapper [`berlin-map.tsx`](../src/components/map/berlin-map.tsx) mit
  `next/dynamic` + `ssr: false` lädt [`berlin-map-inner.tsx`](../src/components/map/berlin-map-inner.tsx)
  (MapLibre + Sheet + Legend)
- Style: OpenFreeMap Positron (gratis, kein Key)
- Heatmap: Yellow→Red Choropleth, Range dynamisch aus min/max der aktuellen Daten
- Legende bottom-right, Detail-Sheet shadcn `<Sheet>` (controlled via `open`/`onOpenChange`)

**Warum**
- Single-Round-Trip-RPC statt mehrere Queries: weniger Latenz, einfacher zu cachen
  später (`'use cache'` ist vorbereitet aber noch nicht aktiviert).
- `next/dynamic` mit `ssr: false`: MapLibre kann nur im Browser rendern (`window`-
  Abhängigkeit). Pattern: Client-Wrapper → dynamic → Inner-Component, weil
  `next/dynamic` mit `ssr: false` nur aus Client Components erlaubt ist.
- shadcn = base-ui-Variante (nicht Radix): `<Sheet>` wird controlled über
  `open` / `onOpenChange`.

**Gotcha (für zukünftige Sessions)**
- MapLibre flacht `feature.properties` ab: alle verschachtelten Objekte werden zu
  JSON-Strings. `rent_history` muss client-seitig mit `JSON.parse()` rekonstruiert
  werden — siehe `parseDistrictProperties()` in `berlin-map-inner.tsx`.

---

## Phase 5.1 — Historische Daten 2012–2025 ✅

**Was**
- 168 historische `rent_data_points` für jeden Bezirk pro Jahr 2012–2025

**Wie**
- Im selben Ingestion-Script wie Phase 2.2 (`berlin-ibb.ts`) — IBB-XLSX enthält
  bereits alle Jahre als separate Tabs/Spalten
- Migration [`0006_districts_geojson_with_history.sql`](../supabase/migrations/20260504_0006_districts_geojson_with_history.sql)
  erweitert die GeoJSON-RPC um ein `rent_history`-Array pro Feature

**Warum**
- IBB liefert die Historie kostenlos mit — kein Grund auf Destatis zu warten.
- `rent_history` direkt im GeoJSON-Feature: vermeidet Second-Roundtrip beim
  Sheet-Open für die Trend-Linie.

---

## Phase 5.2 — Trend-Chart im Detail-Sheet ✅

**Was**
- Recharts LineChart 2012–2025 im Detail-Sheet pro Bezirk
- %-Indikator relativ zu 2012 ("+47% seit 2012")

**Wie**
- Komponente [`rent-history-chart.tsx`](../src/components/map/rent-history-chart.tsx)
- Daten kommen aus `feature.properties.rent_history` (siehe Gotcha oben:
  JSON.parse client-seitig)
- Recharts: ResponsiveContainer + LineChart + XAxis (Jahr) + YAxis (€/m²) + Tooltip

**Warum**
- Recharts statt eigene SVG-Implementierung: Tooltip + Responsive sind out-of-the-box.
- %-Indikator macht die Zahl kontextualisiert greifbar (raw Linie ist nur Linie).

---

## Phase 4.1–4.4 — Fairness-Check `/check` (MVP) ✅

**Was**
- Route `/check` mit Form (Adresse, Wohnfläche, Kaltmiete)
- Adresse → Nominatim-Geocoding (OSM, free, kein Key)
- Lat/Lon → PostGIS `ST_Covers` findet enthaltenden Bezirk
- Vergleich mit IBB-Median des Bezirks → Verdict (4 Stufen) + €/Monat-Differenz
- Quellen-Link, starker Disclaimer (keine Rechtsberatung)

**Wie**
- [`src/app/check/page.tsx`](../src/app/check/page.tsx) — Server Component, rendert `<CheckForm>`
- [`src/app/check/check-form.tsx`](../src/app/check/check-form.tsx) — Client Component
  mit `useActionState`, Form-Felder shadcn `Input`/`Label`, Verdict-Panel mit 4
  farbcodierten Zuständen (`guenstig` / `marktueblich` / `ueber_markt` /
  `weit_ueber_markt`)
- [`src/app/check/actions.ts`](../src/app/check/actions.ts) — `"use server"`,
  Zod-Validation, ruft Geocoding + DB-Lookup auf
- [`src/lib/geocoding.ts`](../src/lib/geocoding.ts) — Nominatim-Wrapper, scoped auf Berlin,
  User-Agent gesetzt (Nominatim-Usage-Policy)
- [`src/lib/data/fairness.ts`](../src/lib/data/fairness.ts) — `findDistrictByPoint()` +
  `assessFairness()` mit Verdict-Tiers basierend auf %-Abweichung
- Migration [`0007_find_district_by_point.sql`](../supabase/migrations/20260505_0007_find_district_by_point.sql)
  — RPC `find_district_by_point(city_id, lon, lat)` mit `ST_Covers` (geography)

**Warum**
- Nominatim statt Photon/Mapbox: free, kein Key, Open-Source-Policy. Limits
  (~1 req/sec) reichen für user-getriebenes Form locker.
- `ST_Covers` statt `ST_Contains`: behandelt Punkte exakt auf der Polygon-Grenze
  korrekt (`Contains` würde sie ausschließen).
- 4-stufiger Verdict: einfaches mentales Modell für Nicht-Juristen.
  Schwellen: <-5% / ±5% / +5–15% / >+15%.
- `useActionState` (React 19) statt eigenes State-Handling: progressive enhancement
  (funktioniert auch ohne JS), Server-Action returns Form-State direkt.
- Server-Action statt API-Route: weniger Boilerplate, Type-Safety End-to-End.

**Bewusst noch nicht drin (kommt in Phase 4.5 / 2.2b)**
- Anonymisierte Speicherung der eingegebenen Daten
- Mietspiegel-konforme Berechnung (aktuell nur Vergleich gegen Markt-Median)
- Mietpreisbremse-Rückforderungs-Schätzung
- PDF-Export, Share-fähiges OG-Image

---

## Keep-Alive-Infrastruktur ✅

**Was**
- Täglicher Cron-Ping gegen Supabase (verhindert Free-Tier-Auto-Pause nach 7 Tagen)
- Monatlicher Heartbeat-Commit (verhindert GitHub-Workflow-Auto-Disable nach 60 Tagen)

**Wie**
- [`.github/workflows/keep-alive.yml`](../.github/workflows/keep-alive.yml) läuft täglich
- Ping: einfache `select 1`-Query gegen Supabase REST
- Heartbeat: alle 30 Tage editiert der Workflow [`.github/heartbeat.txt`](../.github/heartbeat.txt)
  und committet → GitHub sieht Repo-Aktivität → Workflow bleibt aktiv

**Warum**
- Supabase Free pausiert nach 7 Tagen Inaktivität → Erstaufruf bricht ab
- GitHub deaktiviert Workflows nach 60 Tagen ohne Commit → Cron stirbt
- Beide Probleme verkettet: ohne Cron pausiert Supabase, ohne Commit stirbt der Cron
- User wollte explizit "ich möchte nicht daran denken müssen" → komplett
  selbstheilende Lösung

---

## Datenbank-Schema (Phase 1)

| Tabelle | Zweck |
|---|---|
| `cities` | Städte (ID = slug, mit centroid+bbox). Berlin first. |
| `districts` | Bezirke / Ortsteile / PLZ als `MULTIPOLYGON`. Hierarchisch via `parent_id`. |
| `data_sources` | Provenance-Registry: jede Datenquelle mit URL, Lizenz, Typ. |
| `rent_data_points` | Long-Format: pro (source × district × period × metric) eine Zeile. |

Alle Tabellen: RLS aktiviert, public-read-Policy. Writes nur via admin-Client.

## RPC-Funktionen in Supabase

| RPC | Zweck |
|---|---|
| `upsert_city(...)` | Idempotenter City-Insert mit GeoJSON bbox |
| `upsert_district(...)` | Idempotenter District-Insert (Polygon→MultiPolygon Promotion) |
| `upsert_rent_data_point(...)` | Idempotente rent observation, keyed auf (source, district, period, metric, property_type) |
| `get_districts_geojson(city_id)` | FeatureCollection mit aktuellem Median + komplettem `rent_history` Array |
| `find_district_by_point(city_id, lon, lat)` | Bezirk der den Punkt enthält + aktuelle Angebotsmiete + Quellen-Metadaten. `ST_Covers` (geography). Empty result wenn Punkt außerhalb. |

---

## Was läuft wo

- **Live:** https://mietcheck-map.vercel.app
- **Repo:** https://github.com/Hendrik-srs/mietcheck-map
- **Supabase Region:** Frankfurt (DSGVO)
- **Tile-Provider:** OpenFreeMap (Positron-Style)
- **Geocoder:** Nominatim (OSM)
