// Nominatim geocoder (OpenStreetMap). No API key, no cost. Their usage policy
// requires a descriptive User-Agent and max ~1 request/second — both fine for
// our user-driven /check form. https://operations.osmfoundation.org/policies/nominatim/

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
  osmId: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "MietCheckMap/0.1 (https://mietcheck-map.vercel.app; coop3003@gmail.com)";

interface NominatimItem {
  place_id: number;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
}

export async function geocodeAddressInBerlin(
  query: string,
): Promise<GeocodeResult | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", `${query}, Berlin, Deutschland`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", "de");

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Geocoding fehlgeschlagen (HTTP ${res.status})`);
  }

  const items = (await res.json()) as NominatimItem[];
  if (items.length === 0) return null;

  const top = items[0];
  return {
    lat: Number.parseFloat(top.lat),
    lon: Number.parseFloat(top.lon),
    displayName: top.display_name,
    osmId: `${top.osm_type}:${top.osm_id}`,
  };
}
