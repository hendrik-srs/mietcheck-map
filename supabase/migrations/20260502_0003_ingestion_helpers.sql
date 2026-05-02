-- =====================================================================
-- MietCheck Map — Ingestion Helpers
-- =====================================================================
-- Server-side functions invoked by ingestion scripts via supabase-js
-- rpc(). Encapsulating the PostGIS geometry coercion here keeps the
-- TypeScript scripts free of raw SQL and gives us a single place to
-- change geometry handling later.
--
-- Callers must use the secret-key admin client (which bypasses RLS).
-- =====================================================================

create or replace function public.upsert_city(
  p_id            text,
  p_name          text,
  p_state         text,
  p_centroid_lon  double precision,
  p_centroid_lat  double precision,
  p_bbox_geojson  text default null
) returns text
language plpgsql
as $$
declare
  v_centroid geography;
  v_bbox     geography;
begin
  v_centroid := st_setsrid(
    st_makepoint(p_centroid_lon, p_centroid_lat),
    4326
  )::geography;

  v_bbox := case
    when p_bbox_geojson is null then null
    else st_setsrid(st_geomfromgeojson(p_bbox_geojson), 4326)::geography
  end;

  insert into public.cities (id, name, state, centroid, bbox)
  values (p_id, p_name, p_state, v_centroid, v_bbox)
  on conflict (id) do update
    set name     = excluded.name,
        state    = excluded.state,
        centroid = excluded.centroid,
        bbox     = excluded.bbox;

  return p_id;
end;
$$;

comment on function public.upsert_city is
  'Idempotent upsert for cities, accepting bbox as GeoJSON text.';

create or replace function public.upsert_district(
  p_city_id           text,
  p_name              text,
  p_level             text,
  p_geometry_geojson  text,
  p_parent_id         uuid default null
) returns uuid
language plpgsql
as $$
declare
  v_id       uuid;
  v_geometry geography;
begin
  -- ST_Multi promotes Polygon -> MultiPolygon to match the column type.
  v_geometry := st_multi(
    st_setsrid(st_geomfromgeojson(p_geometry_geojson), 4326)
  )::geography;

  insert into public.districts (city_id, name, level, geometry, parent_id)
  values (p_city_id, p_name, p_level, v_geometry, p_parent_id)
  on conflict (city_id, name, level) do update
    set geometry  = excluded.geometry,
        parent_id = excluded.parent_id
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.upsert_district is
  'Idempotent upsert for districts, accepting geometry as GeoJSON text.';
