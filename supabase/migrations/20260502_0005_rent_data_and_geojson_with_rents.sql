-- =====================================================================
-- MietCheck Map — Rent ingestion helper + GeoJSON-with-rents
-- =====================================================================
-- 1) upsert_rent_data_point(): idempotent insert for rent_data_points,
--    keyed on (source, district, period, metric, property_type).
--
-- 2) get_districts_geojson(): replaced version that joins each district
--    with its most recent angebotsmiete_median data point so the map
--    can render a choropleth in a single round-trip.
-- =====================================================================

create or replace function public.upsert_rent_data_point(
  p_source_id     text,
  p_district_id   uuid,
  p_period_start  date,
  p_period_end    date,
  p_metric        text,
  p_value_median  numeric default null,
  p_value_p25     numeric default null,
  p_value_p75     numeric default null,
  p_value_min     numeric default null,
  p_value_max     numeric default null,
  p_sample_size   integer default null,
  p_property_type text default null,
  p_notes         text default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  -- Idempotency: a (source, district, period, metric, property_type) tuple
  -- identifies one observation. Drop the prior row if it exists.
  -- IS NOT DISTINCT FROM handles NULL property_type correctly.
  delete from public.rent_data_points
   where source_id     = p_source_id
     and district_id   = p_district_id
     and period_start  = p_period_start
     and period_end    = p_period_end
     and metric        = p_metric
     and property_type is not distinct from p_property_type;

  insert into public.rent_data_points (
    source_id, district_id, period_start, period_end, metric,
    value_median, value_p25, value_p75, value_min, value_max,
    sample_size, property_type, notes
  ) values (
    p_source_id, p_district_id, p_period_start, p_period_end, p_metric,
    p_value_median, p_value_p25, p_value_p75, p_value_min, p_value_max,
    p_sample_size, p_property_type, p_notes
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.upsert_rent_data_point is
  'Idempotent insert for rent_data_points keyed on (source, district, period, metric, property_type).';


-- Replace the GeoJSON exporter with a version that includes the most
-- recent angebotsmiete_median per district plus its source provenance.
create or replace function public.get_districts_geojson(p_city_id text)
returns jsonb
language sql
stable
as $$
  with latest_rent as (
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
    order by rdp.district_id, rdp.period_end desc, rdp.created_at desc
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
            'rent_source_url',       lr.source_url
          ),
          'geometry', st_asgeojson(d.geometry::geometry)::jsonb
        )
      ),
      '[]'::jsonb
    )
  )
  from public.districts d
  left join latest_rent lr on lr.district_id = d.id
  where d.city_id = p_city_id;
$$;

comment on function public.get_districts_geojson is
  'GeoJSON FeatureCollection of all districts in a city, joined with the latest angebotsmiete_median per district. Designed for MapLibre.';
