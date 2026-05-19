/**
 * Ingestion: Berliner Ortsteile (Phase 2.1b)
 *
 * Source: Geoportal Berlin (mirrored by Technologiestiftung Berlin)
 *   https://daten.odis-berlin.de/de/dataset/ortsteile/
 *
 * Loads the 96 official Ortsteile as MULTIPOLYGON geometries into
 * `districts` (level='ortsteil') with parent_id pointing at the
 * corresponding Bezirk. Idempotent — re-runs overwrite in place via
 * the unique (city_id, name, level) constraint.
 *
 * Run with:
 *   npm run ingest:berlin-ortsteile
 *
 * Requires:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY
 *   - 12 Bezirke already ingested (berlin-districts.ts)
 *   - migrations through 20260520_0012 applied
 */

import { createClient } from "@supabase/supabase-js";
import type { Feature, FeatureCollection, Geometry } from "geojson";

const GEOJSON_URL =
  "https://tsb-opendata.s3.eu-central-1.amazonaws.com/ortsteile/lor_ortsteile.geojson";

const SOURCE = {
  id: "berlin_ortsteile_geoportal",
  name: "Ortsteilgrenzen Berlin",
  publisher: "Geoportal Berlin",
  source_url: "https://daten.odis-berlin.de/de/dataset/ortsteile/",
  license:
    "Geoportal Berlin / Ortsteile — Nutzungsbedingungen: http://www.stadtentwicklung.berlin.de/geoinformation/download/nutzIII.pdf",
  source_type: "open_data" as const,
  notes:
    "Amtliche Ortsteilgrenzen Berlins (96 Ortsteile). Gespiegelt von der Technologiestiftung Berlin (TSB) als GeoJSON.",
};

const CITY_ID = "berlin";

interface OrtsteilProperties {
  OTEIL: string;
  BEZIRK: string;
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

  // 1) Build Bezirk-name → id map (parents must exist).
  console.log("Loading existing Bezirke for parent_id lookup ...");
  const { data: bezirke, error: bezErr } = await supabase
    .from("districts")
    .select("id, name")
    .eq("city_id", CITY_ID)
    .eq("level", "bezirk");
  if (bezErr) throw bezErr;
  if (!bezirke || bezirke.length === 0) {
    throw new Error(
      "No Bezirke found. Run `npm run ingest:berlin-districts` first.",
    );
  }
  const bezirkByName = new Map<string, string>(
    bezirke.map((b) => [b.name, b.id]),
  );
  console.log(`  -> ${bezirke.length} Bezirke loaded`);

  // 2) Fetch Ortsteile GeoJSON.
  console.log(`Fetching ${GEOJSON_URL} ...`);
  const res = await fetch(GEOJSON_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching Ortsteile GeoJSON`);
  const fc = (await res.json()) as FeatureCollection;
  console.log(`  -> ${fc.features.length} features`);

  // 3) Register the data source.
  console.log(`Upserting data source '${SOURCE.id}' ...`);
  const { error: srcErr } = await supabase
    .from("data_sources")
    .upsert(SOURCE, { onConflict: "id" });
  if (srcErr) throw srcErr;

  // 4) Upsert each Ortsteil with parent_id resolved by Bezirks-Name.
  let upserted = 0;
  const skipped: string[] = [];
  for (const feature of fc.features as Feature<Geometry, OrtsteilProperties>[]) {
    const name = feature.properties?.OTEIL?.trim();
    const bezirkName = feature.properties?.BEZIRK?.trim();
    if (!name || !bezirkName) {
      console.warn(`  ! feature missing OTEIL or BEZIRK, skipping`);
      continue;
    }
    const parentId = bezirkByName.get(bezirkName);
    if (!parentId) {
      skipped.push(`${name} (Bezirk '${bezirkName}' not found)`);
      continue;
    }
    const { error } = await supabase.rpc("upsert_district", {
      p_city_id: CITY_ID,
      p_name: name,
      p_level: "ortsteil",
      p_geometry_geojson: JSON.stringify(feature.geometry),
      p_parent_id: parentId,
    });
    if (error) {
      throw new Error(`Failed to upsert Ortsteil '${name}': ${error.message}`);
    }
    upserted += 1;
  }

  console.log(`\nDone. Upserted ${upserted} Ortsteile into 'districts'.`);
  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length}:`);
    for (const s of skipped) console.warn(`  - ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
