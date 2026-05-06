-- =====================================================================
-- MietCheck Map — Berliner Mietspiegel 2024 Tabellenwerte (Phase 2.2b)
-- =====================================================================
-- Die offizielle Mietspiegeltabelle (Senatsverwaltung Stadtentwicklung,
-- Stichtag 01.09.2023) als 163 strukturierte Zeilen.
--
-- Quelle: https://www.berlin.de/sen/wohnen/_assets/service/mietspiegel2024.pdf
-- Lizenz: amtliches Werk, gemeinfrei nach §5 UrhG
--
-- Schema-Eigenheit: Die Wohnflächen-Klassen sind je nach Wohnlage und
-- Baualter unterschiedlich geschnitten (statistisches Auswertungsverfahren).
-- Wir können also kein Kreuzprodukt bilden — jede Zeile ist ein eigener,
-- explizit definierter Datenpunkt mit (size_sqm_min, size_sqm_max).
--
-- Die laufende Zeilennummer aus dem PDF (1..163) ist UNIQUE → robuster
-- ON-CONFLICT-Pfad für Re-Ingestion.
-- =====================================================================

create table if not exists public.berlin_mietspiegel_2024 (
  id                       uuid primary key default gen_random_uuid(),
  zeile_nr                 integer not null unique check (zeile_nr between 1 and 999),
  wohnlage                 text not null check (wohnlage in ('einfach', 'mittel', 'gut')),
  baualter_label           text not null,
  baualter_year_min        integer,                       -- null = open-ended (z.B. "bis 1918")
  baualter_year_max        integer,
  west_ost                 text check (west_ost in ('west', 'ost') or west_ost is null),
  size_sqm_label           text not null,
  size_sqm_min             numeric(6,2),                  -- null = open-ended
  size_sqm_max             numeric(6,2),
  value_lower_eur_per_sqm  numeric(6,2),
  value_median_eur_per_sqm numeric(6,2),
  value_upper_eur_per_sqm  numeric(6,2),
  sample_too_small         boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists berlin_mietspiegel_2024_lookup_idx
  on public.berlin_mietspiegel_2024 (wohnlage, baualter_year_min, baualter_year_max, west_ost);

comment on table public.berlin_mietspiegel_2024 is
  'Berliner Mietspiegel 2024 – ortsübliche Vergleichsmieten (Nettokalt, EUR/m²/Monat) als 163 Tabellenzeilen pro (wohnlage × baualter × wohnungsgröße).';

-- Row Level Security ---------------------------------------------------
alter table public.berlin_mietspiegel_2024 enable row level security;

drop policy if exists "Public read berlin_mietspiegel_2024"
  on public.berlin_mietspiegel_2024;

create policy "Public read berlin_mietspiegel_2024"
  on public.berlin_mietspiegel_2024 for select using (true);

grant select on public.berlin_mietspiegel_2024 to anon, authenticated;
grant all    on public.berlin_mietspiegel_2024 to service_role;

-- =====================================================================
-- Ingest helper: idempotenter Bulk-Upsert via JSONB
-- =====================================================================
create or replace function public.upsert_berlin_mietspiegel_2024_batch(
  p_rows jsonb
) returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  with input as (
    select
      (r->>'zeile_nr')::integer                    as zeile_nr,
      (r->>'wohnlage')::text                       as wohnlage,
      (r->>'baualter_label')::text                 as baualter_label,
      nullif(r->>'baualter_year_min', '')::integer as baualter_year_min,
      nullif(r->>'baualter_year_max', '')::integer as baualter_year_max,
      nullif(r->>'west_ost', '')::text             as west_ost,
      (r->>'size_sqm_label')::text                 as size_sqm_label,
      nullif(r->>'size_sqm_min', '')::numeric      as size_sqm_min,
      nullif(r->>'size_sqm_max', '')::numeric      as size_sqm_max,
      nullif(r->>'value_lower_eur_per_sqm', '')::numeric  as value_lower,
      nullif(r->>'value_median_eur_per_sqm', '')::numeric as value_median,
      nullif(r->>'value_upper_eur_per_sqm', '')::numeric  as value_upper,
      coalesce((r->>'sample_too_small')::boolean, false)  as sample_too_small
    from jsonb_array_elements(p_rows) as r
  )
  insert into public.berlin_mietspiegel_2024 as m (
    zeile_nr, wohnlage, baualter_label, baualter_year_min, baualter_year_max,
    west_ost, size_sqm_label, size_sqm_min, size_sqm_max,
    value_lower_eur_per_sqm, value_median_eur_per_sqm, value_upper_eur_per_sqm,
    sample_too_small
  )
  select
    zeile_nr, wohnlage, baualter_label, baualter_year_min, baualter_year_max,
    west_ost, size_sqm_label, size_sqm_min, size_sqm_max,
    value_lower, value_median, value_upper,
    sample_too_small
  from input
  on conflict (zeile_nr) do update
    set wohnlage                  = excluded.wohnlage,
        baualter_label            = excluded.baualter_label,
        baualter_year_min         = excluded.baualter_year_min,
        baualter_year_max         = excluded.baualter_year_max,
        west_ost                  = excluded.west_ost,
        size_sqm_label            = excluded.size_sqm_label,
        size_sqm_min              = excluded.size_sqm_min,
        size_sqm_max              = excluded.size_sqm_max,
        value_lower_eur_per_sqm   = excluded.value_lower_eur_per_sqm,
        value_median_eur_per_sqm  = excluded.value_median_eur_per_sqm,
        value_upper_eur_per_sqm   = excluded.value_upper_eur_per_sqm,
        sample_too_small          = excluded.sample_too_small,
        updated_at                = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.upsert_berlin_mietspiegel_2024_batch is
  'Idempotent bulk upsert für die 163 Mietspiegel-Zeilen. Service-role only.';

-- =====================================================================
-- Lookup-Helper: Wohnlage + Baualter + Größe → Mietspiegel-Werte
-- =====================================================================
-- Verwendet im Fairness-Check, sobald wir Wohnlage + Adresse haben.
-- Liefert die passende Zeile (oder null wenn keine matching Zeile).
--
-- Matching-Logik:
--   - wohnlage exact match
--   - baualter im Range [year_min, year_max] (open-ended möglich)
--   - größe im Range [size_min, size_max] (open-ended möglich)
--   - west_ost: wenn p_west_ost gesetzt → exact match;
--               wenn null → west_ost-NULL-Zeilen (nicht-Doppelung)
--                          ODER beide West/Ost-Zeilen wenn Baualter 1973-1990
--                          (in dem Fall müsste der Caller einen Wert mitgeben;
--                           wir defaulten auf "ost" wenn nicht gesetzt — siehe
--                           Roadmap, Berlin-West-Sonderfall ist out-of-scope MVP)
-- =====================================================================
create or replace function public.find_mietspiegel_2024_row(
  p_wohnlage      text,
  p_baujahr       integer,
  p_size_sqm      numeric,
  p_west_ost      text default null
) returns table (
  zeile_nr                 integer,
  wohnlage                 text,
  baualter_label           text,
  size_sqm_label           text,
  west_ost                 text,
  value_lower_eur_per_sqm  numeric,
  value_median_eur_per_sqm numeric,
  value_upper_eur_per_sqm  numeric,
  sample_too_small         boolean
)
language sql
stable
as $$
  select
    m.zeile_nr,
    m.wohnlage,
    m.baualter_label,
    m.size_sqm_label,
    m.west_ost,
    m.value_lower_eur_per_sqm,
    m.value_median_eur_per_sqm,
    m.value_upper_eur_per_sqm,
    m.sample_too_small
  from public.berlin_mietspiegel_2024 m
  where m.wohnlage = p_wohnlage
    and (m.baualter_year_min is null or m.baualter_year_min <= p_baujahr)
    and (m.baualter_year_max is null or m.baualter_year_max >= p_baujahr)
    and (m.size_sqm_min is null or m.size_sqm_min <= p_size_sqm)
    and (m.size_sqm_max is null or m.size_sqm_max >  p_size_sqm)
    -- West/Ost-Filter: wenn west_ost-Zeile existiert, erwartet p_west_ost.
    -- Caller, die den Sonderfall nicht kennen, kriegen die "ost"-Zeile als
    -- konservativen Default (Mietspiegel-2024-Definition: Ost-Werte sind
    -- typischerweise niedriger → Verdict-Tendenz "deine Miete ist hoch"
    -- statt false-negative).
    and (
      m.west_ost is null
      or m.west_ost = coalesce(p_west_ost, 'ost')
    )
  order by m.zeile_nr
  limit 1;
$$;

comment on function public.find_mietspiegel_2024_row is
  'Liefert die passende Mietspiegel-Zeile für (wohnlage, baujahr, m², west/ost). NULL wenn keine Zeile matcht.';
