import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { createClient } from "@/lib/supabase/server";

export interface DistrictProperties {
  id: string;
  name: string;
  level: "bezirk" | "ortsteil" | "plz";
}

export type DistrictsFeatureCollection = FeatureCollection<
  Polygon | MultiPolygon,
  DistrictProperties
>;

export async function getDistrictsGeoJSON(
  cityId: string,
): Promise<DistrictsFeatureCollection> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_districts_geojson", {
    p_city_id: cityId,
  });
  if (error) throw error;
  return data as DistrictsFeatureCollection;
}
