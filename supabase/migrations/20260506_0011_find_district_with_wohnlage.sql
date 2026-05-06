-- =====================================================================
-- MietCheck Map — find_district_by_point inkl. Wohnlage (Phase 2.2b)
-- =====================================================================
-- Ergänzt die bestehende find_district_by_point-Funktion um die
-- nächstgelegene Wohnlage-Adresse aus berlin_wohnlagen. Damit liefert
-- ein einziger RPC-Call alles, was der Fairness-Check braucht:
--   - Bezirk + aktuelle IBB-Angebotsmiete (wie bisher)
--   - Wohnlage + Bezirk-Bezeichnung aus dem Mietspiegel-Datensatz
--   - Adresse, Distanz (zur Sanity-Anzeige im UI)
--
-- Wir ersetzen die alte Signatur durch DROP+CREATE (Returns ändern sich,
-- daher kein simpler CREATE OR REPLACE möglich).
-- =====================================================================

drop function if exists public.find_district_by_point(text, double precision, double precision);

create or replace function public.find_district_by_point(
  p_city_id text,
  p_lon     double precision,
  p_lat     double precision
) returns table (
  district_id            uuid,
  district_name          text,
  district_level         text,
  rent_median            numeric,
  rent_sample_size       integer,
  rent_period_start      date,
  rent_period_end        date,
  rent_metric            text,
  rent_source_id         text,
  rent_source_name       text,
  rent_source_publisher  text,
  rent_source_url        text,
  wohnlage               text,
  wohnlage_strasse       text,
  wohnlage_hausnummer    text,
  wohnlage_plz           text,
  wohnlage_distance_m    numeric
)
language sql
stable
as $$
  with hit as (
    select d.id, d.name, d.level
    from public.districts d
    where d.city_id = p_city_id
      and st_covers(
        d.geometry,
        st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography
      )
    limit 1
  ),
  latest_rent as (
    select distinct on (rdp.district_id)
      rdp.district_id,
      rdp.value_median,
      rdp.sample_size,
      rdp.period_start,
      rdp.period_end,
      rdp.metric,
      rdp.source_id,
      ds.name      as source_name,
      ds.publisher as source_publisher,
      ds.source_url
    from public.rent_data_points rdp
    join public.data_sources ds on ds.id = rdp.source_id
    where rdp.metric = 'angebotsmiete_median_eur_per_sqm'
      and rdp.district_id = (select id from hit)
    order by rdp.district_id, rdp.period_end desc, rdp.created_at desc
  ),
  -- Wohnlagen-Lookup: nearest neighbor auf der adress-genauen Punkt-Tabelle.
  -- Limit 1 + KNN-Operator (<->) liefert die räumlich nächste Adresse zur
  -- gegebenen Koordinate. ST_Distance gibt die Entfernung in Metern (via
  -- geography-Cast) für die Anzeige im UI ("nächste klassifizierte Adresse:
  -- X m entfernt").
  nearest_wohnlage as (
    select
      bw.wohnlage,
      bw.strasse,
      bw.hausnummer,
      bw.plz,
      st_distance(
        bw.geom,
        st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography
      ) as distance_m
    from public.berlin_wohnlagen bw
    order by bw.geom <-> st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography
    limit 1
  )
  select
    h.id            as district_id,
    h.name          as district_name,
    h.level         as district_level,
    lr.value_median as rent_median,
    lr.sample_size  as rent_sample_size,
    lr.period_start as rent_period_start,
    lr.period_end   as rent_period_end,
    lr.metric       as rent_metric,
    lr.source_id    as rent_source_id,
    lr.source_name  as rent_source_name,
    lr.source_publisher as rent_source_publisher,
    lr.source_url   as rent_source_url,
    nw.wohnlage     as wohnlage,
    nw.strasse      as wohnlage_strasse,
    nw.hausnummer   as wohnlage_hausnummer,
    nw.plz          as wohnlage_plz,
    nw.distance_m   as wohnlage_distance_m
  from hit h
  left join latest_rent      lr on lr.district_id = h.id
  left join nearest_wohnlage nw on true;
$$;

comment on function public.find_district_by_point is
  'Returns Bezirk + latest IBB-Angebotsmiete + nearest Wohnlage (Mietspiegel 2024) for (lon, lat). Wohnlage-Felder sind null wenn berlin_wohnlagen leer ist.';
