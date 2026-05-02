/**
 * Ingestion: IBB Wohnungsmarktbericht 2025 — Angebotsmieten pro Bezirk
 *
 * Source: Investitionsbank Berlin (CC-BY 4.0)
 *   https://www.ibb.de/de/ueber-uns/publikationen/wohnungsmarktbericht/2025.html
 *
 * Inserts one rent_data_point per Berlin Bezirk: the median asking rent
 * (Nettokaltmiete €/m²) for calendar year 2025, with sample size from
 * the same row. Joins to `districts` by Bezirk name (matches Geoportal
 * Berlin naming exactly).
 *
 * Run with:
 *   npm run ingest:berlin-ibb-2025
 *
 * Requires:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY
 *   - migration 20260502_0005_rent_data_and_geojson_with_rents.sql applied
 *   - Berlin districts already ingested (run berlin-districts.ts first)
 */

import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

const XLSX_URL =
  "https://www.ibb.de/media/dokumente/publikationen/berliner-wohnungsmarkt/wohnungsmarktbericht/2025/ibb-wohnungsmarktbericht-angebotsmieten_2012-2025.xlsx";

const SOURCE = {
  id: "ibb_wohnungsmarktbericht_2025",
  name: "IBB Wohnungsmarktbericht 2025 — Angebotsmieten",
  publisher: "Investitionsbank Berlin (IBB)",
  source_url:
    "https://www.ibb.de/de/ueber-uns/publikationen/wohnungsmarktbericht/2025.html",
  license:
    "CC-BY 4.0 — Quelle: IBB Wohnungsmarktbericht 2025; Daten der VALUE Marktdatenbank, eigene Berechnungen der RegioKontext GmbH",
  source_type: "market_report" as const,
  reference_date: "2025-12-31",
  notes:
    "Median Angebotsmiete (Nettokaltmiete in EUR/m²/Monat) pro Berliner Bezirk, Kalenderjahr 2025. Datenquelle: VALUE Marktdatenbank (Online-Inserate).",
};

const PERIOD_START = "2025-01-01";
const PERIOD_END = "2025-12-31";
const METRIC = "angebotsmiete_median_eur_per_sqm";
const SHEET_NAME = "Bezirksdaten_2025";

interface BezirkRow {
  name: string;
  median: number;
  sampleSize: number;
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

  console.log(`Fetching ${XLSX_URL} ...`);
  const res = await fetch(XLSX_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching XLSX`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found in workbook`);

  // Rows 11-22 hold the 12 Bezirke. Columns: B=ID, C=Name, E=Median, G=Inserate.
  const records: BezirkRow[] = [];
  for (let rowIdx = 11; rowIdx <= 22; rowIdx++) {
    const row = sheet.getRow(rowIdx);
    const name = String(row.getCell(3).value ?? "").trim();
    const median = toNumber(row.getCell(5).value);
    const sampleSize = toInteger(row.getCell(7).value);
    if (!name || median === null || sampleSize === null) {
      throw new Error(
        `Row ${rowIdx}: incomplete data (name=${name} median=${median} n=${sampleSize})`,
      );
    }
    records.push({ name, median, sampleSize });
  }
  console.log(`  -> parsed ${records.length} Bezirke from "${SHEET_NAME}"`);

  // Resolve district UUIDs by name.
  const { data: districts, error: dErr } = await supabase
    .from("districts")
    .select("id, name")
    .eq("city_id", "berlin")
    .eq("level", "bezirk");
  if (dErr) throw dErr;
  const idByName = new Map((districts ?? []).map((d) => [d.name, d.id]));

  console.log(`Upserting source '${SOURCE.id}' ...`);
  const { error: srcErr } = await supabase
    .from("data_sources")
    .upsert(SOURCE, { onConflict: "id" });
  if (srcErr) throw srcErr;

  let upserted = 0;
  for (const rec of records) {
    const districtId = idByName.get(rec.name);
    if (!districtId) {
      throw new Error(
        `No matching district for "${rec.name}". DB has: ${[...idByName.keys()].join(", ")}`,
      );
    }
    const { error } = await supabase.rpc("upsert_rent_data_point", {
      p_source_id: SOURCE.id,
      p_district_id: districtId,
      p_period_start: PERIOD_START,
      p_period_end: PERIOD_END,
      p_metric: METRIC,
      p_value_median: rec.median,
      p_sample_size: rec.sampleSize,
    });
    if (error) {
      throw new Error(`Failed for ${rec.name}: ${error.message}`);
    }
    upserted += 1;
    console.log(
      `  + ${rec.name.padEnd(28)} ${rec.median.toFixed(2).padStart(5)} €/m²   (n=${rec.sampleSize})`,
    );
  }

  console.log(`\nDone. Upserted ${upserted} rent data points.`);
}

function toNumber(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (v && typeof v === "object" && "result" in v) {
    return toNumber((v as { result: ExcelJS.CellValue }).result);
  }
  return null;
}

function toInteger(v: ExcelJS.CellValue): number | null {
  const n = toNumber(v);
  return n === null ? null : Math.round(n);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
