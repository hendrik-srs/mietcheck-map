-- =====================================================================
-- MietCheck Map — get_districts_geojson() v3 (with rent_history)
-- =====================================================================
-- Adds a `rent_history` array to each feature's properties so the
-- client can render a sparkline / line chart per district without a
-- second roundtrip.
-- =====================================================================

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
  where d.city_id = p_city_id;
$$;

comment on function public.get_districts_geojson is
  'GeoJSON FeatureCollection of districts with latest median + full rent history per district. Designed for MapLibre + Recharts.';
