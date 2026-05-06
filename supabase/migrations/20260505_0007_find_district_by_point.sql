-- =====================================================================
-- MietCheck Map — find_district_by_point()
-- =====================================================================
-- Looks up the Bezirk that contains a (lon, lat) point and joins it with
-- the most recent angebotsmiete_median observation for that district.
--
-- Used by the Fairness-Check (/check): user enters address -> Nominatim
-- geocodes it -> we use this RPC to find which Bezirk the address falls
-- into and return the comparison rent in one round-trip.
--
-- Returns NULL row if the point is outside every district in the city
-- (e.g. user typed an address from a different city).
-- =====================================================================

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
  rent_source_url        text
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
    -- A clean polygon set has no overlaps but we cap at 1 just in case.
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
    lr.source_url   as rent_source_url
  from hit h
  left join latest_rent lr on lr.district_id = h.id;
$$;

comment on function public.find_district_by_point is
  'Returns the district containing (lon, lat) within a city, joined with its latest angebotsmiete_median. Empty result if the point is outside every district.';
