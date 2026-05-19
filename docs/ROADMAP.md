# MietCheck Map — Roadmap (offene Phasen)

> Status der **fertigen** Phasen → siehe [BUILD_EXPLANATION.md](BUILD_EXPLANATION.md).
> Aktueller Top-Level-Stand + Prioritäten → siehe [`../CLAUDE.md`](../CLAUDE.md).

Diese Datei beschreibt alle offenen Roadmap-Schritte im Detail. Pro Schritt:
Ziel, geplante Umsetzung, ggf. Abhängigkeiten.

---

## Phase 2 — Datenpipeline (offene Schritte)

### Schritt 2.1b — Berliner Ortsteile *(live ✅)*
- ✅ 96 Ortsteil-Polygone aus dem Geoportal Berlin (`lor_ortsteile.geojson`)
  in `districts` mit `level='ortsteil'` und `parent_id` → Bezirk
- ✅ `find_district_by_point` bevorzugt Ortsteil-Match und liefert
  Parent-Bezirk mit; Rent-Join läuft weiter über den Bezirk
- ✅ `get_districts_geojson` filtert auf `level='bezirk'`, damit die Heatmap
  bei den 12 Bezirken bleibt
- ✅ `/check` zeigt zusätzliche "Ortsteil"-Zeile in den Eingabe-Details

### Schritt 2.2b — Mietspiegel 2024 ingestieren *(live ✅)*
- ✅ Berliner Mietspiegel 2024 als zusätzliche Quelle (163 Tabellenzeilen,
  gemeinfrei nach §5 UrhG, eingecheckt als JSON)
- ✅ Wohnlagen-Adress-Lookup aus dem Geoportal-WFS (≈401k Adressen,
  dl-de-zero-2.0)
- ✅ `find_mietspiegel_2024_row(wohnlage, baujahr, sqm, west_ost)` RPC
- ✅ `/check` zeigt zusätzlich Mietspiegel-Spanne mit Position der Miete +
  Mietpreisbremsen-Hinweis ab Mittelwert + 10 %
- West/Ost-Sonderfall (1973–1990) wird konservativ pro Bezirk inferiert
  (Straßenverzeichnis aus Amtsblatt nicht maschinenlesbar — out-of-scope MVP)

### Schritt 2.3 — Destatis-Trend-Daten *(optional)*
- Destatis GENESIS-API: Verbraucherpreisindex Wohnen, monatlich
- Aktuell verzichtbar, weil IBB-Historie 2012–2025 alles liefert
- Sinnvoll falls Multi-City: Destatis-Daten gibt's bundesweit

### Schritt 2.4 — Auto-Ingestion via GitHub Actions *(live ✅)*
- ✅ `auto-ingest.yml` — monatlich am 4. um 02:30 UTC läuft `npm run ingest:all`
  (Districts, Wohnlagen, IBB, Mietspiegel). Idempotent, partielle Erfolge ok
- ✅ Daily Drift-Check: probt IBB-2026/27/28 + Mietspiegel-2026/27/28 PDF-URLs.
  Bei 200 OK → öffnet GitHub-Issue "neue Quelle verfügbar" (max. 1 offen)
- ✅ Failure-Mode: Job-Failure öffnet automatisch Issue mit Run-URL — kein
  externer Service, keine Kosten
- ✅ Manuell triggerbar via workflow_dispatch (Ingest oder Drift-Check)
- **Setup-Schritt**: Repo-Secrets `NEXT_PUBLIC_SUPABASE_URL` und
  `SUPABASE_SECRET_KEY` einmalig anlegen

---

## Phase 3 — Karte (Restpunkte)

### Schritt 3.4 (Restpunkte)
- **p25/p75-Spanne** im Detail-Sheet — IBB liefert sie nicht, also entweder
  warten auf andere Quelle oder weglassen
- **Mobile-Bottom-Sheet** — aktuell rechts-gleitend auch auf Mobile.
  Plan: `data-side="bottom"` per Media-Query

### Schritt 3.5 — Stadt-Wechsel-UI
- Header bekommt Dropdown / Tabs für Stadt-Auswahl
- City-spezifische Routen `/karte?stadt=muenchen`
- Erst sinnvoll **nachdem** Phase 6 läuft (sonst nur Berlin auswählbar)

---

## Phase 4 — Fairness-Check (Restpunkte)

### Schritt 4.5 — Anonymisiert in der Datenbank speichern *(MVP live ✅)*
- ✅ Tabelle `crowdsourced_rents` (Migration 0008): `district_id`, `size_sqm`,
  `monthly_rent_eur`, `building_age_bracket`, `status`, `submitted_at` —
  KEINE Adresse, keine E-Mail, keine User-ID, keine IP
- ✅ Opt-in-Checkbox im Form mit DSGVO-Hinweis + Baualter-Select (optional)
- ✅ Moderations-Flow: Submissions starten als `pending`, sind nicht public
  lesbar; Review im Supabase-Studio durch Status-Flip auf `approved`
- ✅ RLS: public-read nur für `status='approved'`; Inserts ausschließlich
  über Service-Role-RPC `submit_crowdsourced_rent`

**Offene Folgeschritte (nach Volumen):**
- Verdict-Logik um Mietspiegel-Werte erweitern, sobald 2.2b läuft
- Approved-Submissions in Karte/Verdict einfließen lassen (z.B. Median-Tooltip
  ergänzen sobald n ≥ x pro Bezirk erreicht ist)
- Optional: Ergebnis-PDF-Export, Share-fähiges OG-Image (`next/og`)
- Optional später: Admin-UI für Moderation statt Supabase-Studio

---

## Phase 5 — Trends & Polish (Restpunkte)

### Schritt 5.2 (Restpunkte)
- Eigene Routen `/trends/[bezirk]` (Detail) und `/trends/vergleich`
  (Multi-Bezirk-Overlay)
- Recharts kann Multi-Line; Daten via `get_districts_geojson` schon vorhanden

### Schritt 5.3 — SEO-Bezirks-Seiten *(live ✅)*
- ✅ `/bezirk/[slug]` mit `generateStaticParams` für alle 12 Berliner
  Bezirke; build-time-known slug→name Mapping in `src/lib/slugs.ts`
- ✅ Inhalt: aktueller Median + Vergleich zum Stadt-Durchschnitt +
  RentHistoryChart + Quellen-Box + interne Links zu Karte/Check
- ✅ Strukturierte Daten als `schema.org/Place` (JSON-LD inline)
- ✅ Dynamisches OG-Image via `next/og` (`opengraph-image.tsx`) pro Bezirk
- ✅ Sitemap-Erweiterung um alle Bezirks-URLs
- ✅ Bezirks-Footer-Liste auf Landing-Page für interne Verlinkung

### Schritt 5.4 — Quellen-Transparenz-Seite *(live ✅)*
- ✅ Route `/quellen` mit Liste aller `data_sources` aus der DB, gruppiert
  nach `source_type` (Marktbericht, Mietspiegel, Open Data, …)
- ✅ Pro Quelle: Name, Herausgeber, Lizenz, reference_date, fetched_at,
  Notes, Original-Link
- ✅ Lizenz-Erklärung (dl-de-zero-2.0, §5 UrhG) am Fuß
- ✅ Globaler SiteHeader-Link auf jeder Seite

---

## Phase 6 — Multi-City-Erweiterung

**Ziel:** München, Hamburg, Köln dazu.

- Pro Stadt: Geometrien (Open-Data der jeweiligen Stadt) + Mietspiegel
  + lokale Statistik-Quellen
- Stadt-Auswahl im Header funktional machen (Phase 3.5)
- City-spezifische Routen / Query-Parameter
- Lessons-Learned aus Berlin: pro Stadt 1–2 Tage Aufwand wenn Pipeline steht
- Reihenfolge-Vorschlag: München (Mietspiegel sehr gut dokumentiert) →
  Hamburg → Köln

---

## Phase 7 — Monetarisierung *(optional)*

In Reihenfolge der Realisierbarkeit:

1. **Premium-PDF-Report** für Mieter — detaillierte Bewertung,
   Senkungs-Anspruch-Berechnung, Anwalts-Vorlage. Preis 5–15 € via Stripe.
2. **Affiliate** — Mieterverein-Mitgliedschaften, Mietrechts-Anwälte
3. **API-Access** — für Journalisten, Forscher, Makler. Tiered Pricing.
4. **White-Label** für Wohnungsbau-Genossenschaften

**Vor Monetarisierung notwendig:**
- Impressum, Datenschutzerklärung, AGB pflegen
- Anwalts-Konsultation für Mietpreisbremsen-Berechnung empfehlenswert
  (Disclaimer-Stärke, Haftungsfrage)
- Cloudflare Pages als Backup falls Vercel Hobby restriktiver wird
  (kein "non-commercial only"-Constraint dort)

---

## Aktuelle Top-Prioritäten

(Quelle: [`../CLAUDE.md`](../CLAUDE.md) Status-Sektion)

1. **Phase 6** — München/Hamburg/Köln
2. **Phase 3.5** — Stadt-Wechsel-UI (mit Phase 6)
3. **Phase 4.5+** — Crowdsourced-Mieten in Karte/Verdict, sobald Volumen da
4. **Phase 4.6 (optional)** — Sondermerkmale-Slider im Mietspiegel-Vergleich
5. **Phase 7** — Monetarisierung (PDF-Report, Affiliate, API-Access)
