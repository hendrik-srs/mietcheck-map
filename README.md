# MietCheck Map

> Transparente Mietpreis-Karte für Deutschland — rechtsverbindliche Vergleichsmieten,
> Fairness-Check und Trends, ausschließlich aus offiziellen Quellen.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20PostGIS-3ECF8E)](https://supabase.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Worum geht's?

Mietkarten gibt es viele — die meisten basieren auf Inseratspreisen aus Plattformen
wie ImmoScout24 oder immowelt. Das ist:

- **rechtlich problematisch** (Scraping verstößt gegen AGB und Datenbankschutzrechte),
- **nicht repräsentativ** (Inserate sind nur die obere, volatile Spitze des Marktes),
- **nicht rechtsverbindlich** (für die Mietpreisbremse zählt der Mietspiegel).

**MietCheck Map** macht das anders: Wir nutzen ausschließlich frei zugängliche,
offizielle Quellen und legen jeden Datenpunkt transparent offen.

## Features

- 🗺️ **Interaktive Karte** (`/karte`) mit Heatmap der durchschnittlichen Kaltmiete
   pro Berliner Bezirk und Klick-Sheet mit Detail-Panel — *live*
- ⚖️ **Fairness-Check** (`/check`) — Adresse + qm + Miete eingeben, sofort sehen,
   wie die Miete gegenüber dem Bezirks-Median steht — *live (MVP)*
- 📈 **Trend-Charts** pro Bezirk seit 2012 (Recharts) im Detail-Sheet — *live*
- 🔍 **Quellen-Transparenz** — jeder Wert mit seiner Quelle verlinkt

## Datenquellen (alle frei zugänglich)

| Quelle | Granularität | Update |
|---|---|---|
| Berliner Mietspiegel (Senatsverwaltung) | Stadtteil/Straße | 2-jährlich |
| Amt für Statistik Berlin-Brandenburg | Bezirk/PLZ | Quartalsweise |
| BBSR Wohnungsmarktbeobachtung | Kreis | Quartalsweise |
| Destatis GENESIS-API | Land/Region | Monatlich |
| Geschäftsberichte Vonovia, degewo, Howoge, Gesobau | Bestand | Quartalsweise |
| CBRE / JLL / immowelt-Marktberichte (öffentliche PDFs) | Bezirk | Quartalsweise |
| BORIS-D Bodenrichtwerte | Grundstück | Jährlich |
| Berlin Open Data | divers | divers |

## Tech-Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **Karte**: MapLibre GL JS, react-map-gl
- **Charts**: Recharts
- **Backend**: Supabase (Postgres + PostGIS), RLS-protected
- **Hosting**: Vercel
- **CI/CD**: GitHub Actions (geplant für Datenpipeline-Cronjobs)

## Lokale Entwicklung

### Voraussetzungen

- Node.js ≥ 20
- Ein Supabase-Projekt (Region: Frankfurt empfohlen für DSGVO)

### Setup

```bash
git clone https://github.com/Hendrik-srs/mietcheck-map.git
cd mietcheck-map
npm install

# Env-Variablen konfigurieren
cp .env.example .env.local
# Editiere .env.local mit deinen Supabase-Keys

# Datenbank-Schema anwenden:
# Supabase Dashboard -> SQL Editor -> Inhalt von supabase/migrations/*.sql ausführen

npm run dev
```

App läuft dann auf [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm run start
```

## Projekt-Struktur

```
.
├── src/
│   ├── app/                    # Next.js App Router (Routes, Layouts)
│   ├── components/ui/          # shadcn/ui Komponenten
│   └── lib/
│       └── supabase/           # Supabase client (browser, server, admin)
├── supabase/
│   └── migrations/             # SQL-Migrationen (chronologisch)
└── public/                     # Statische Assets
```

## Roadmap

- [x] **Phase 1**: Projekt-Setup, Schema, Landing-Page, Production-Deploy
- [x] **Phase 2.1 + 2.2**: 12 Berliner Bezirks-Geometrien + IBB Wohnungsmarktbericht 2025 (168 rent_data_points, 2012–2025)
- [x] **Phase 3**: Interaktive Karte `/karte` mit Bezirks-Heatmap und Detail-Sheet
- [x] **Phase 4 (MVP)**: Fairness-Check `/check` mit Adress-Geocoding und Bezirks-Lookup
- [x] **Phase 5.1 + 5.2**: Historie 2012–2025 + Trend-Chart pro Bezirk im Detail-Sheet
- [ ] **Phase 4.5**: anonymisierter Crowdsourcing-Layer
- [ ] **Phase 2.2b**: Mietspiegel 2024 für rechtssichere Mietpreisbremse-Berechnung
- [ ] **Phase 5.3 + 5.4**: SEO-Bezirks-Seiten + öffentliche Quellen-Seite
- [ ] **Phase 6**: Erweiterung auf München, Hamburg, Köln

> Detaillierter Stand und Architektur-Doku: [`CLAUDE.md`](CLAUDE.md),
> [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/BUILD_EXPLANATION.md`](docs/BUILD_EXPLANATION.md).

## Lizenz

MIT — siehe [LICENSE](LICENSE).

Daten der zugrundeliegenden Quellen unterliegen den jeweiligen Lizenzen
der Herausgeber (in der App pro Datenpunkt verlinkt).
