-- =====================================================================
-- MietCheck Map — Initial Schema
-- =====================================================================
-- Design goals:
--   * Multi-source rent data (Mietspiegel, Destatis, BBSR, market reports,
--     public housing companies, etc.) with full provenance tracking
--   * Geographic queries via PostGIS (heatmap by district / proximity search)
--   * Public read access; writes restricted to service-role / authenticated
--     users (later)
--   * Extensible to multiple cities — Berlin first, others to follow
-- =====================================================================

-- 1) Extensions ---------------------------------------------------------
create extension if not exists postgis;

-- 2) Cities -------------------------------------------------------------
create table if not exists public.cities (
  id          text primary key,                      -- 'berlin', 'muenchen'
  name        text not null,
  state       text not null,                          -- Bundesland
  centroid    geography(point, 4326) not null,
  bbox        geography(polygon, 4326),
  created_at  timestamptz not null default now()
);

comment on table public.cities is
  'Cities supported by the platform. ID is a stable slug used in URLs.';

-- 3) Districts (Bezirke / Ortsteile / PLZ areas) ------------------------
create table if not exists public.districts (
  id          uuid primary key default gen_random_uuid(),
  city_id     text not null references public.cities(id) on delete cascade,
  name        text not null,
  level       text not null check (level in ('bezirk', 'ortsteil', 'plz')),
  parent_id   uuid references public.districts(id) on delete set null,
  geometry    geography(multipolygon, 4326) not null,
  created_at  timestamptz not null default now(),
  unique (city_id, name, level)
);

create index if not exists districts_geometry_idx
  on public.districts using gist (geometry);
create index if not exists districts_city_idx
  on public.districts (city_id);
create index if not exists districts_parent_idx
  on public.districts (parent_id);

comment on table public.districts is
  'Geographic regions within a city. Hierarchical: Bezirk -> Ortsteil -> PLZ.';

-- 4) Data sources (transparency registry) -------------------------------
create table if not exists public.data_sources (
  id              text primary key,                   -- e.g. 'berlin_mietspiegel_2024'
  name            text not null,
  publisher       text not null,                      -- "Senatsverwaltung für Stadtentwicklung"
  source_url      text,
  license         text,                                -- 'CC-BY 3.0 DE', 'public domain', etc.
  source_type     text not null check (source_type in (
    'mietspiegel',
    'destatis',
    'bbsr',
    'gutachterausschuss',
    'public_company_report',
    'market_report',
    'open_data',
    'crowdsourced'
  )),
  reference_date  date,                                -- date the data describes
  fetched_at      timestamptz not null default now(),  -- when we ingested it
  notes           text
);

comment on table public.data_sources is
  'Every data point is linked back to its source. Powers the transparency UI.';

-- 5) Rent data points ---------------------------------------------------
create table if not exists public.rent_data_points (
  id                 uuid primary key default gen_random_uuid(),
  source_id          text not null references public.data_sources(id) on delete cascade,
  district_id        uuid not null references public.districts(id)    on delete cascade,
  period_start       date not null,
  period_end         date not null,
  metric             text not null check (metric in (
    'nettokaltmiete_eur_per_sqm',
    'warmmiete_eur_per_sqm',
    'angebotsmiete_median_eur_per_sqm',
    'bestandsmiete_median_eur_per_sqm'
  )),
  value_median       numeric(8,2),
  value_p25          numeric(8,2),
  value_p75          numeric(8,2),
  value_min          numeric(8,2),
  value_max          numeric(8,2),
  sample_size        integer,
  property_type      text,                              -- 'altbau', 'neubau', 'all'
  building_age_min   integer,
  building_age_max   integer,
  size_sqm_min       numeric(6,2),
  size_sqm_max       numeric(6,2),
  notes              text,
  created_at         timestamptz not null default now(),
  check (period_start <= period_end)
);

create index if not exists rent_data_points_district_idx
  on public.rent_data_points (district_id);
create index if not exists rent_data_points_period_idx
  on public.rent_data_points (period_start, period_end);
create index if not exists rent_data_points_source_idx
  on public.rent_data_points (source_id);
create index if not exists rent_data_points_metric_idx
  on public.rent_data_points (metric);

comment on table public.rent_data_points is
  'Long-format rent observations. One row per (source, district, period, metric).';

-- 6) Row Level Security -------------------------------------------------
alter table public.cities            enable row level security;
alter table public.districts         enable row level security;
alter table public.data_sources      enable row level security;
alter table public.rent_data_points  enable row level security;

-- Public read access for all reference tables. Writes go through the
-- secret-key admin client (which bypasses RLS).
drop policy if exists "Public read cities"           on public.cities;
drop policy if exists "Public read districts"        on public.districts;
drop policy if exists "Public read data_sources"     on public.data_sources;
drop policy if exists "Public read rent_data_points" on public.rent_data_points;

create policy "Public read cities"
  on public.cities           for select using (true);
create policy "Public read districts"
  on public.districts        for select using (true);
create policy "Public read data_sources"
  on public.data_sources     for select using (true);
create policy "Public read rent_data_points"
  on public.rent_data_points for select using (true);
