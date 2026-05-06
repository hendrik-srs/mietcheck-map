Workflow-Guide → docs/WORKFLOW.md

@AGENTS.md

# MietCheck Map — Projekt-Kontext für Claude

## Worum es geht

Open-Source-Mietpreis-Karte für Deutschland mit Fairness-Check. USP: **ausschließlich
offizielle, frei zugängliche Quellen** (Mietspiegel, IBB, Destatis, BBSR, BORIS-D,
Open Data der Länder). Kein Scraping. Jeder Datenpunkt mit Quelle verlinkt.
Ziel: portfolio-tauglich, später potenziell monetarisierbar.

Live: https://mietcheck-map.vercel.app · Repo: https://github.com/Hendrik-srs/mietcheck-map

## Aktueller Stand

**Live (✅):** Phase 1 (Setup) · 2.1 (12 Bezirks-Geometrien) · 2.2 (IBB-Mietdaten 2012–25)
· 2.2b (Berliner Mietspiegel 2024 + 401k Wohnlagen-Adressen)
· 2.4 (Auto-Ingestion via GitHub Actions, monatlich + täglicher Drift-Check)
· 3.1–3.4 (`/karte` mit Heatmap + Detail-Sheet) · 5.1 (Historie) · 5.2 (Trend-Chart)
· 4.1–4.4 MVP + 4.5 (`/check` mit IBB-Markt-Vergleich + Mietspiegel-Vergleich +
anonymem Opt-in-Beitrag) · Keep-Alive (Cron + Heartbeat)

**Was als nächstes ansteht** (in Prioritätsreihenfolge):
1. **Phase 5.3 + 5.4** — SEO-Bezirks-Seiten + öffentliche Quellen-Seite
2. **Phase 2.1b** — Berliner Ortsteile (~100 Polygone, feinerer Lookup)
3. **Phase 6** — München/Hamburg/Köln
4. **Phase 3.5** — Stadt-Wechsel-UI (sobald Phase 6 läuft)
5. **Phase 4.5+** — Crowdsourced-Mieten in Karte/Verdict einbinden, sobald Volumen da
6. **Phase 4.6 (optional)** — Sondermerkmale-/Spanneneinordnung-Slider im Mietspiegel-Vergleich

**Operative Notizen**
- **Crowdsourced-Submissions** liegen als `status='pending'` in `crowdsourced_rents`.
  Review im Supabase-Studio: Status auf `approved` setzen → Eintrag wird public.
- **GitHub-Repo-Secrets** für `auto-ingest.yml` einmalig setzen:
  `NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_SECRET_KEY` (Settings → Secrets and
  variables → Actions). Workflow läuft sonst automatisch monatlich.

→ **Details aller offenen Phasen:** [docs/ROADMAP.md](docs/ROADMAP.md)
→ **Was/Wie/Warum bei fertigen Phasen:** [docs/BUILD_EXPLANATION.md](docs/BUILD_EXPLANATION.md)

## Architektur-Überblick

**Stack:** Next.js 16 (App Router) + TS · Tailwind v4 + shadcn/ui (base-ui-Variante)
· Supabase Postgres+PostGIS (Frankfurt) · MapLibre GL JS · Recharts · Vercel
· OpenFreeMap-Tiles · Nominatim-Geocoder · GitHub Actions (Keep-Alive).

```
src/
├── app/
│   ├── page.tsx                  # Landing
│   ├── karte/page.tsx            # Karte (Server, lädt districts via rpc)
│   └── check/                    # Fairness-Check
│       ├── page.tsx              # Server Component
│       ├── check-form.tsx        # Client (useActionState + Verdict)
│       └── actions.ts            # "use server" + Zod
├── components/
│   ├── ui/                       # shadcn Komponenten
│   └── map/                      # berlin-map(-inner).tsx + rent-history-chart.tsx
└── lib/
    ├── geocoding.ts              # Nominatim-Wrapper
    ├── data/{districts,fairness,crowdsourced}.ts
    └── supabase/{browser,server,admin}.ts

scripts/ingest/                   # berlin-districts.ts, berlin-ibb.ts,
                                  # berlin-wohnlagen.ts, berlin-mietspiegel-2024.ts
                                  # data/berlin-mietspiegel-2024.json (eingecheckt)
supabase/migrations/              # 0001..0011 (manuell im SQL Editor anwenden)
.github/workflows/keep-alive.yml  # Daily Ping + Heartbeat-Commit alle 30 Tage
.github/workflows/auto-ingest.yml # Monatliche Re-Ingestion + täglicher Drift-Check
```

**Tabellen:** `cities` · `districts` (MULTIPOLYGON) · `data_sources` ·
`rent_data_points` (Long-Format pro source × district × period × metric) ·
`crowdsourced_rents` (anonyme Opt-in-Submissions, RLS public-read nur für
`status='approved'`) · `berlin_wohnlagen` (≈401k Adress-Punkte + Wohnlage,
GiST-Index für KNN-Lookup) · `berlin_mietspiegel_2024` (163 Zeilen aus dem
offiziellen Mietspiegel-PDF).
RLS aktiviert, public-read, Writes nur via admin-Client.

**RPCs:** `upsert_city/district/rent_data_point` · `get_districts_geojson(city_id)`
(GeoJSON inkl. `rent_history`) · `find_district_by_point(city_id, lon, lat)`
(`ST_Covers` + nearest-Wohnlage; liefert Bezirk + IBB-Median + Wohnlage in einem
Roundtrip) · `find_mietspiegel_2024_row(wohnlage, baujahr, sqm, west_ost)`
(passende Tabellenzeile) · `submit_crowdsourced_rent` (Service-Role-only, insert
als pending) · `upsert_berlin_wohnlagen_batch`/`upsert_berlin_mietspiegel_2024_batch`
(Bulk-Ingest via JSONB).

## Konventionen & Regeln

1. **Migrations**: chronologisch in `supabase/migrations/`. Nach `Write` einer
   Migration auf User-Bestätigung warten ("Success. No rows returned"), dann erst
   weitermachen. Supabase CLI ist absichtlich noch nicht eingerichtet.
2. **Env-Vars**: `NEXT_PUBLIC_*` öffentlich ok, `SUPABASE_SECRET_KEY` server-only.
   Worktree braucht Symlink: `ln -s ../../../.env.local .env.local` vom
   Worktree-Root aus, danach Server-Restart.
3. **Daten-Quellen-Regel**: Nichts scrapen. Wenn nur per Scraping verfügbar —
   andere Quelle suchen oder Datenpunkt weglassen. UI zeigt immer Quelle + Lizenz.
4. **Push-Workflow**: User arbeitet auf Worktree-Branch, Push direkt nach main via
   `git push origin HEAD:main`. Kein PR-Step. Vercel deployt automatisch.
5. **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
   Pro Roadmap-Schritt: `feat(phase-X.Y): kurze Zusammenfassung`.
6. **Sprache**: Deutsch in UI-Texten und mit User. English in Code-Kommentaren
   und Commit-Messages.
7. **Komponenten**: Server Components default, `"use client"` nur bei Bedarf.
   Functional, mit TypeScript-Props.
8. **Icons**: lucide-react. `Github`-Icon existiert nicht (Markenrecht raus) —
   stattdessen `Code2` oder Inline-SVG.
9. **Ingestion-Scripts sind idempotent**: Re-runs überschreiben in place.

→ **Bug-Lessons & Gotchas** (MapLibre-Property-Flattening, base-ui Button+Link,
Layout-Kollaps, Next.js-16-Caching): in meinem persistenten Memory gespeichert,
ich konsultiere sie wenn relevant.

## Befehle

```bash
npm run dev                       # Dev-Server (Turbopack), http://localhost:3000
npm run build                     # Production-Build (lokal vor Push verifizieren)
npm run lint                      # ESLint
npm run start                     # Production-Server (lokal nach build)

# Ingestion (idempotent, brauchen .env.local mit SUPABASE_SECRET_KEY)
npm run ingest:berlin-districts          # Geoportal Berlin → 12 Bezirke
npm run ingest:berlin-ibb                # IBB Wohnungsmarktbericht → 168 rent points
npm run ingest:berlin-wohnlagen          # WFS → ≈401k Adressen mit Wohnlage (~min)
npm run ingest:berlin-mietspiegel-2024   # JSON-Datei → 163 Mietspiegel-Zeilen
npm run ingest:all                       # alle 4 nacheinander (auto-ingest-Workflow)
```

## Was beim Session-Start zu tun ist

1. `git status` + `git log -5` zur Orientierung
2. Status-Sektion oben zeigt was live ist und was als nächstes ansteht.
   Letzter Commit gibt zusätzlichen Hinweis.
3. User fragen, ob die Top-Priorität angegangen wird oder Sprung an andere Stelle
4. Konkreten Schritt aus [ROADMAP](docs/ROADMAP.md) nehmen, eigene TodoWrite-Liste
   bauen, abarbeiten
5. Pro Schritt: Commit + `git push origin HEAD:main` + visuelle Verifikation
6. Vor Migrations-Anwendung auf User-Bestätigung warten

→ **Tiefe Recherche zu fertigen Features** (warum X gewählt, wie zusammengesetzt):
[docs/BUILD_EXPLANATION.md](docs/BUILD_EXPLANATION.md) — nur lesen wenn die
aktuelle Aufgabe etwas Gebautes erweitert oder anfasst.
