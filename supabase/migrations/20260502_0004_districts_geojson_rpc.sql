-- =====================================================================
-- MietCheck Map — get_districts_geojson()
-- =====================================================================
-- Returns all districts of a city as a GeoJSON FeatureCollection,
-- ready to feed into MapLibre as a `geojson` source. Avoids hex-WKB
-- decoding round-trips in the application layer.
-- =====================================================================

create or replace function public.get_districts_geojson(p_city_id text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'id', id,
          'properties', jsonb_build_object(
            'id', id,
            'name', name,
            'level', level
          ),
          'geometry', st_asgeojson(geometry::geometry)::jsonb
        )
      ),
      '[]'::jsonb
    )
  )
  from public.districts
  where city_id = p_city_id;
$$;

comment on function public.get_districts_geojson is
  'GeoJSON FeatureCollection of all districts in a city. Designed for MapLibre.';
