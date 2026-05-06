-- =====================================================================
-- MietCheck Map — Berliner Wohnlagen nach Mietspiegel 2024 (Phase 2.2b)
-- =====================================================================
-- Adress-genauer Wohnlagen-Lookup ('einfach' / 'mittel' / 'gut').
-- Quelle: Geoportal Berlin / Senatsverwaltung Stadtentwicklung,
--         WFS "wohnlagenadr2024" (≈400k Adressen, dl-de-zero-2.0).
--
-- Use-Case: Im Fairness-Check liefern wir nach dem Geocoding den
-- Mietspiegel-Wert für die exakte Adresse — dafür brauchen wir die
-- Wohnlage in O(1)/O(log n).
--
-- Lookup-Strategie:
--   1) Direkt-Match per (PLZ, Strasse, Hausnummer) wenn verfügbar
--   2) Fallback: nearest neighbor via PostGIS auf der Punkt-Geometrie
-- =====================================================================

create table if not exists public.berlin_wohnlagen (
  id           uuid primary key default gen_random_uuid(),
  schluessel   text not null unique,                    -- WFS-Adressschlüssel, idempotenter PK
  bezirk       text,
  stadtteil    text,
  plr_name     text,
  plz          text,
  strasse      text,
  hausnummer   text,
  wohnlage     text not null check (wohnlage in ('einfach', 'mittel', 'gut')),
  geom         geography(point, 4326) not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- GiST für räumliche Nearest-Neighbor-Suche (KNN: ORDER BY geom <-> point).
create index if not exists berlin_wohnlagen_geom_idx
  on public.berlin_wohnlagen using gist (geom);

-- Direkt-Lookup-Pfad: PLZ + Straße ist hochselektiv; Hausnummer als
-- Tiebreaker. Lower-cased für Case-insensitive Matching.
create index if not exists berlin_wohnlagen_addr_idx
  on public.berlin_wohnlagen (plz, lower(strasse), hausnummer);

create index if not exists berlin_wohnlagen_bezirk_idx
  on public.berlin_wohnlagen (bezirk);

comment on table public.berlin_wohnlagen is
  'Address-level Wohnlage classification per Berliner Mietspiegel 2024.';

-- Row Level Security ---------------------------------------------------
alter table public.berlin_wohnlagen enable row level security;

drop policy if exists "Public read berlin_wohnlagen"
  on public.berlin_wohnlagen;

create policy "Public read berlin_wohnlagen"
  on public.berlin_wohnlagen for select using (true);

grant select on public.berlin_wohnlagen to anon, authenticated;
grant all    on public.berlin_wohnlagen to service_role;

-- =====================================================================
-- Ingestion helper RPC (idempotent batch upsert)
-- =====================================================================
-- The TS ingest script will paginate through the WFS endpoint and call
-- this RPC in batches to avoid round-trip overhead. Accepting a JSONB
-- array means we can ship 1000 rows per call.
-- =====================================================================
create or replace function public.upsert_berlin_wohnlagen_batch(
  p_rows jsonb
) returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  with input as (
    select
      (r->>'schluessel')::text       as schluessel,
      (r->>'bezirk')::text           as bezirk,
      (r->>'stadtteil')::text        as stadtteil,
      (r->>'plr_name')::text         as plr_name,
      (r->>'plz')::text              as plz,
      (r->>'strasse')::text          as strasse,
      (r->>'hausnummer')::text       as hausnummer,
      (r->>'wohnlage')::text         as wohnlage,
      (r->>'lon')::double precision  as lon,
      (r->>'lat')::double precision  as lat
    from jsonb_array_elements(p_rows) as r
  )
  insert into public.berlin_wohnlagen as bw (
    schluessel, bezirk, stadtteil, plr_name, plz, strasse, hausnummer,
    wohnlage, geom
  )
  select
    schluessel, bezirk, stadtteil, plr_name, plz, strasse, hausnummer,
    wohnlage,
    st_setsrid(st_makepoint(lon, lat), 4326)::geography
  from input
  on conflict (schluessel) do update
    set bezirk     = excluded.bezirk,
        stadtteil  = excluded.stadtteil,
        plr_name   = excluded.plr_name,
        plz        = excluded.plz,
        strasse    = excluded.strasse,
        hausnummer = excluded.hausnummer,
        wohnlage   = excluded.wohnlage,
        geom       = excluded.geom,
        updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.upsert_berlin_wohnlagen_batch is
  'Idempotent batch upsert for the WFS-driven wohnlagen ingest. Service-role only.';
