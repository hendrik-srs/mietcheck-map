/**
 * Ingestion: Berlin Bezirksgrenzen
 *
 * Source: Geoportal Berlin (mirrored by Technologiestiftung Berlin)
 *   https://daten.odis-berlin.de/de/dataset/bezirksgrenzen/
 *
 * Loads the official 12 Bezirke as MULTIPOLYGON geometries into
 * `districts`, after upserting the Berlin city seed and the data
 * source registry entry.
 *
 * Run with:
 *   npm run ingest:berlin-districts
 *
 * Requires:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY
 *   - migration 20260502_0003_ingestion_helpers.sql applied
 */

import { createClient } from "@supabase/supabase-js";
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson";

const GEOJSON_URL =
  "https://tsb-opendata.s3.eu-central-1.amazonaws.com/bezirksgrenzen/bezirksgrenzen.geojson";

const SOURCE = {
  id: "berlin_bezirksgrenzen_geoportal",
  name: "Bezirksgrenzen Berlin",
  publisher: "Geoportal Berlin",
  source_url: "https://daten.odis-berlin.de/de/dataset/bezirksgrenzen/",
  license:
    "Geoportal Berlin / Bezirksgrenzen — Nutzungsbedingungen: http://www.stadtentwicklung.berlin.de/geoinformation/download/nutzIII.pdf",
  source_type: "open_data" as const,
  notes:
    "Amtliche Bezirksgrenzen Berlins (12 Bezirke). Gespiegelt von der Technologiestiftung Berlin (TSB) als GeoJSON.",
};

const BERLIN = {
  id: "berlin",
  name: "Berlin",
  state: "Berlin",
  // Approx. centroid (Brandenburger Tor area) — overwritten by bbox-derived
  // centroid in a later phase if we want exact ST_Centroid of city polygon.
  centroidLon: 13.405,
  centroidLat: 52.52,
};

interface BezirkProperties {
  Gemeinde_name: string;
  Gemeinde_schluessel?: string;
  Schluessel_gesamt?: string;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment.",
    );
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Fetching ${GEOJSON_URL} ...`);
  const res = await fetch(GEOJSON_URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching Berlin GeoJSON`);
  }
  const fc = (await res.json()) as FeatureCollection;
  console.log(`  -> ${fc.features.length} features`);

  const bbox = computeBbox(fc);
  console.log(
    `  bbox: [${bbox.map((n) => n.toFixed(4)).join(", ")}]`,
  );

  console.log(`Upserting city '${BERLIN.id}' ...`);
  const { error: cityErr } = await supabase.rpc("upsert_city", {
    p_id: BERLIN.id,
    p_name: BERLIN.name,
    p_state: BERLIN.state,
    p_centroid_lon: BERLIN.centroidLon,
    p_centroid_lat: BERLIN.centroidLat,
    p_bbox_geojson: JSON.stringify(bboxToPolygon(bbox)),
  });
  if (cityErr) throw cityErr;

  console.log(`Upserting data source '${SOURCE.id}' ...`);
  const { error: srcErr } = await supabase
    .from("data_sources")
    .upsert(SOURCE, { onConflict: "id" });
  if (srcErr) throw srcErr;

  let upserted = 0;
  for (const feature of fc.features as Feature<Geometry, BezirkProperties>[]) {
    const name = feature.properties?.Gemeinde_name?.trim();
    if (!name) {
      console.warn("  ! feature without Gemeinde_name, skipping");
      continue;
    }
    const { error } = await supabase.rpc("upsert_district", {
      p_city_id: BERLIN.id,
      p_name: name,
      p_level: "bezirk",
      p_geometry_geojson: JSON.stringify(feature.geometry),
    });
    if (error) {
      throw new Error(`Failed to upsert '${name}': ${error.message}`);
    }
    upserted += 1;
    console.log(`  + ${name}`);
  }

  console.log(`\nDone. Upserted ${upserted} Bezirke into 'districts'.`);
}

type Bbox = [number, number, number, number];

function computeBbox(fc: FeatureCollection): Bbox {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const f of fc.features) {
    if (!f.geometry) continue;
    visitCoords(f.geometry, (lon, lat) => {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    });
  }
  return [minLon, minLat, maxLon, maxLat];
}

function visitCoords(g: Geometry, fn: (lon: number, lat: number) => void) {
  switch (g.type) {
    case "Point":
      fn(g.coordinates[0], g.coordinates[1]);
      return;
    case "MultiPoint":
    case "LineString":
      for (const [lon, lat] of g.coordinates) fn(lon, lat);
      return;
    case "MultiLineString":
    case "Polygon":
      for (const ring of g.coordinates)
        for (const [lon, lat] of ring) fn(lon, lat);
      return;
    case "MultiPolygon":
      for (const poly of g.coordinates)
        for (const ring of poly)
          for (const [lon, lat] of ring) fn(lon, lat);
      return;
    case "GeometryCollection":
      for (const sub of g.geometries) visitCoords(sub, fn);
      return;
  }
}

function bboxToPolygon([minLon, minLat, maxLon, maxLat]: Bbox): Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
