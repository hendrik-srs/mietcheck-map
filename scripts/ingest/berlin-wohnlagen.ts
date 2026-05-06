/**
 * Ingestion: Berliner Wohnlagen nach Mietspiegel 2024
 *
 * Source: Geoportal Berlin / Senatsverwaltung Stadtentwicklung
 *   Dataset: https://daten.berlin.de/datensaetze/wohnlagen-nach-adressen-zum-berliner-mietspiegel-2024-wfs-eddbff85
 *   WFS:     https://gdi.berlin.de/services/wfs/wohnlagenadr2024
 *   License: dl-de-zero-2.0 (CC0-equivalent, no attribution required)
 *
 * Pulls ~400k addresses with their classified Wohnlage ('einfach' /
 * 'mittel' / 'gut') and inserts them into `berlin_wohnlagen`. Used by
 * the Fairness-Check to look up the Mietspiegel-relevant Wohnlage for
 * an exact address.
 *
 * Run with:
 *   npm run ingest:berlin-wohnlagen
 *
 * Requires:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY
 *   - migration 20260506_0009_berlin_wohnlagen.sql applied
 *
 * Notes:
 *   - WFS 2.0 paginiert via startIndex + count.
 *   - Idempotent dank UNIQUE(schluessel) + ON CONFLICT DO UPDATE in der
 *     Helper-RPC.
 *   - Bei Verbindungs-Hickup einfach erneut starten — schon ingestierte
 *     Schlüssel werden geupdatet, neue dazu.
 */

import { createClient } from "@supabase/supabase-js";

const WFS_BASE = "https://gdi.berlin.de/services/wfs/wohnlagenadr2024";
const TYPE_NAME = "wohnlagenadr2024:wohnlagenadr2024";
const PAGE_SIZE = 2000;

const SOURCE = {
  id: "berlin_wohnlagen_mietspiegel_2024",
  name: "Wohnlagen nach Adressen zum Berliner Mietspiegel 2024",
  publisher: "Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin",
  source_url:
    "https://daten.berlin.de/datensaetze/wohnlagen-nach-adressen-zum-berliner-mietspiegel-2024-wfs-eddbff85",
  license: "dl-de-zero-2.0",
  source_type: "open_data" as const,
  reference_date: "2024-06-10",
  notes:
    "Adress-genauer Wohnlagen-Katalog (einfach/mittel/gut) aus dem Berliner Mietspiegel 2024, abgerufen via WFS-Endpoint des Geoportals Berlin.",
};

interface WfsFeature {
  type: "Feature";
  id?: string;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  } | null;
  properties: Record<string, unknown> | null;
}

interface WfsFeatureCollection {
  type: "FeatureCollection";
  numberReturned?: number;
  numberMatched?: number | string;
  features: WfsFeature[];
}

function getCapabilitiesUrl() {
  const u = new URL(WFS_BASE);
  u.searchParams.set("service", "WFS");
  u.searchParams.set("version", "2.0.0");
  u.searchParams.set("request", "GetFeature");
  u.searchParams.set("typeNames", TYPE_NAME);
  u.searchParams.set("outputFormat", "application/json");
  u.searchParams.set("srsName", "EPSG:4326");
  return u;
}

function pageUrl(startIndex: number) {
  const u = getCapabilitiesUrl();
  u.searchParams.set("count", String(PAGE_SIZE));
  u.searchParams.set("startIndex", String(startIndex));
  return u.toString();
}

interface BatchRow {
  schluessel: string;
  bezirk: string | null;
  stadtteil: string | null;
  plr_name: string | null;
  plz: string | null;
  strasse: string | null;
  hausnummer: string | null;
  wohnlage: "einfach" | "mittel" | "gut";
  lon: number;
  lat: number;
}

function pickString(props: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = props[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function normalizeWohnlage(raw: string | null): "einfach" | "mittel" | "gut" | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s.startsWith("einfach")) return "einfach";
  if (s.startsWith("mittel") || s.startsWith("mittlere")) return "mittel";
  if (s.startsWith("gut")) return "gut";
  return null;
}

function featureToRow(f: WfsFeature): BatchRow | null {
  if (!f.geometry || f.geometry.type !== "Point") return null;
  const [lon, lat] = f.geometry.coordinates;
  if (typeof lon !== "number" || typeof lat !== "number") return null;
  const props = f.properties ?? {};

  const schluessel = pickString(props, "schluessel", "schluess");
  const wohnlage = normalizeWohnlage(pickString(props, "wol", "wohnlage"));
  if (!schluessel || !wohnlage) return null;

  return {
    schluessel,
    bezirk: pickString(props, "bezname", "bezirk"),
    stadtteil: pickString(props, "stadtteil"),
    plr_name: pickString(props, "plr_name", "plr"),
    plz: pickString(props, "plz"),
    strasse: pickString(props, "strasse", "str_name"),
    hausnummer: pickString(props, "hnr", "hausnr", "hausnummer"),
    wohnlage,
    lon,
    lat,
  };
}

async function fetchPage(startIndex: number): Promise<WfsFeatureCollection> {
  const url = pageUrl(startIndex);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`WFS HTTP ${res.status} at startIndex=${startIndex}`);
  }
  return (await res.json()) as WfsFeatureCollection;
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

  console.log(`Upserting data source '${SOURCE.id}' ...`);
  {
    const { error } = await supabase
      .from("data_sources")
      .upsert(SOURCE, { onConflict: "id" });
    if (error) throw error;
  }

  console.log(`Probing WFS at startIndex=0 ...`);
  const first = await fetchPage(0);
  if (first.features.length === 0) {
    console.log("WFS returned 0 features; nothing to ingest.");
    return;
  }
  const totalMatched =
    typeof first.numberMatched === "number"
      ? first.numberMatched
      : Number(first.numberMatched ?? "NaN");
  console.log(
    `  numberReturned=${first.features.length}` +
      (Number.isFinite(totalMatched) ? `, numberMatched=${totalMatched}` : ""),
  );

  const sampleProps = first.features[0]?.properties ?? {};
  console.log(`  sample property keys: ${Object.keys(sampleProps).join(", ")}`);

  let totalIngested = 0;
  let totalSkipped = 0;
  let pages = 0;

  let pageFc: WfsFeatureCollection = first;
  let startIndex = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    pages += 1;
    const rows: BatchRow[] = [];
    for (const f of pageFc.features) {
      const row = featureToRow(f);
      if (row) rows.push(row);
      else totalSkipped += 1;
    }

    if (rows.length > 0) {
      const { data, error } = await supabase.rpc(
        "upsert_berlin_wohnlagen_batch",
        { p_rows: rows },
      );
      if (error) {
        throw new Error(
          `Batch upsert failed at startIndex=${startIndex}: ${error.message}`,
        );
      }
      const affected = typeof data === "number" ? data : rows.length;
      totalIngested += affected;
    }

    const returned = pageFc.features.length;
    process.stdout.write(
      `  [page ${pages}] startIndex=${startIndex} returned=${returned} ingested=${totalIngested}` +
        (Number.isFinite(totalMatched) ? `/${totalMatched}` : "") +
        ` skipped=${totalSkipped}\n`,
    );

    if (returned < PAGE_SIZE) break;

    startIndex += PAGE_SIZE;
    pageFc = await fetchPage(startIndex);
  }

  console.log(
    `\nDone. ${totalIngested} addresses upserted across ${pages} page(s); ${totalSkipped} skipped.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
