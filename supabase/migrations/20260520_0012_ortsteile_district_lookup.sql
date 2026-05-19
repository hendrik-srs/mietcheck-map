-- =====================================================================
-- MietCheck Map — Phase 2.1b: Ortsteile als feinere Lookup-Granularität
-- =====================================================================
-- Berlin hat 12 Bezirke und 96 Ortsteile. Ortsteile leben in derselben
-- `districts`-Tabelle (level='ortsteil', parent_id verweist auf den Bezirk)
-- und werden über den existierenden upsert_district-RPC ingestiert.
--
-- Diese Migration passt die zwei Read-RPCs an die neue Realität an:
--
-- 1) get_districts_geojson — Heatmap soll weiterhin nur die 12 Bezirke
--    rendern. Sobald 96 Ortsteile dazukommen, würde der ungefilterte Join
--    108 Features zurückgeben und die Karte überfrachten. Wir filtern hier
--    explizit auf level='bezirk', sodass die Map-UI nichts ändern muss.
--
-- 2) find_district_by_point — Adress-Lookup soll feiner werden. Bevorzugt
--    den Ortsteil-Treffer (level='ortsteil' kommt zuerst), liefert aber
--    zusätzlich den Parent-Bezirk mit, weil rent_data_points nur auf
--    Bezirks-Ebene existieren. Rent-Join wechselt deshalb von der Hit-ID
--    auf die Parent-Bezirks-ID (bzw. die Hit-ID selbst, wenn das schon
--    der Bezirk ist).
-- =====================================================================

-- 1) Heatmap nur Bezirke ------------------------------------------------
create or replace function public.get_districts_geojson(p_city_id text)
returns jsonb
language sql
stable
as $$
  with rents as (
    select
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
  ),
  latest_rent as (
    select distinct on (district_id) *
    from rents
    order by district_id, period_end desc
  ),
  rent_history as (
    select
      district_id,
      jsonb_agg(
        jsonb_build_object(
          'period_end', period_end,
          'value_median', value_median,
          'sample_size', sample_size
        ) order by period_end
      ) as history
    from rents
    group by district_id
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'id', d.id,
          'properties', jsonb_build_object(
            'id',                    d.id,
            'name',                  d.name,
            'level',                 d.level,
            'rent_median',           lr.value_median,
            'rent_sample_size',      lr.sample_size,
            'rent_period_start',     lr.period_start,
            'rent_period_end',       lr.period_end,
            'rent_metric',           lr.metric,
            'rent_source_id',        lr.source_id,
            'rent_source_name',      lr.source_name,
            'rent_source_publisher', lr.source_publisher,
            'rent_source_url',       lr.source_url,
            'rent_history',          coalesce(rh.history, '[]'::jsonb)
          ),
          'geometry', st_asgeojson(d.geometry::geometry)::jsonb
        )
      ),
      '[]'::jsonb
    )
  )
  from public.districts d
  left join latest_rent  lr on lr.district_id = d.id
  left join rent_history rh on rh.district_id = d.id
  where d.city_id = p_city_id
    and d.level   = 'bezirk';
$$;

comment on function public.get_districts_geojson is
  'GeoJSON FeatureCollection of BEZIRK-level districts (Ortsteile excluded) with latest median + full rent history per district.';


-- 2) Adress-Lookup: Ortsteil bevorzugen, Parent-Bezirk mitliefern -------
drop function if exists public.find_district_by_point(text, double precision, double precision);

create or replace function public.find_district_by_point(
  p_city_id text,
  p_lon     double precision,
  p_lat     double precision
) returns table (
  district_id            uuid,
  district_name          text,
  district_level         text,
  parent_district_id     uuid,
  parent_district_name   text,
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
    -- ST_Covers matcht potenziell zwei Polygone (Bezirk + Ortsteil), wenn
    -- beide ingestiert sind. Wir bevorzugen Ortsteil als feinere
    -- Granularität; fällt zurück auf Bezirk wenn nur dieser existiert.
    select d.id, d.name, d.level, d.parent_id
    from public.districts d
    where d.city_id = p_city_id
      and st_covers(
        d.geometry,
        st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography
      )
    order by case d.level
               when 'ortsteil' then 1
               when 'bezirk'   then 2
               else 3
             end
    limit 1
  ),
  -- Ist der Hit ein Ortsteil, ist der Parent-Bezirk dessen parent_id.
  -- Ist der Hit selbst ein Bezirk, fungiert er als sein eigener "Parent",
  -- damit der Rent-Lookup weiterhin trifft.
  parent_bezirk as (
    select
      coalesce(h.parent_id, h.id) as bezirk_id,
      coalesce(pd.name, h.name)   as bezirk_name
    from hit h
    left join public.districts pd
      on pd.id = h.parent_id
     and pd.level = 'bezirk'
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
      and rdp.district_id = (select bezirk_id from parent_bezirk)
    order by rdp.district_id, rdp.period_end desc, rdp.created_at desc
  ),
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
    h.id                as district_id,
    h.name              as district_name,
    h.level             as district_level,
    pb.bezirk_id        as parent_district_id,
    pb.bezirk_name      as parent_district_name,
    lr.value_median     as rent_median,
    lr.sample_size      as rent_sample_size,
    lr.period_start     as rent_period_start,
    lr.period_end       as rent_period_end,
    lr.metric           as rent_metric,
    lr.source_id        as rent_source_id,
    lr.source_name      as rent_source_name,
    lr.source_publisher as rent_source_publisher,
    lr.source_url       as rent_source_url,
    nw.wohnlage         as wohnlage,
    nw.strasse          as wohnlage_strasse,
    nw.hausnummer       as wohnlage_hausnummer,
    nw.plz              as wohnlage_plz,
    nw.distance_m       as wohnlage_distance_m
  from hit h
  left join parent_bezirk     pb on true
  left join latest_rent       lr on lr.district_id = pb.bezirk_id
  left join nearest_wohnlage  nw on true;
$$;

comment on function public.find_district_by_point is
  'Returns finest matching district (Ortsteil bevorzugt) + Parent-Bezirk + latest IBB-Angebotsmiete (auf Bezirks-Ebene) + nearest Wohnlage. Rent join läuft über den Parent-Bezirk, weil rent_data_points nur auf Bezirks-Ebene existieren.';
