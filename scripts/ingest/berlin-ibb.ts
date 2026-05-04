/**
 * Ingestion: IBB Wohnungsmarktbericht — Angebotsmieten pro Bezirk
 *                                         (2012 - 2025, all years)
 *
 * Source: Investitionsbank Berlin (CC-BY 4.0)
 *   https://www.ibb.de/de/ueber-uns/publikationen/wohnungsmarktbericht/2025.html
 *
 * The IBB XLSX contains one `Bezirksdaten_YYYY` sheet per calendar year
 * 2012 through 2025. This script walks all of them and inserts one
 * rent_data_point per (Bezirk × year), matching the modern 12 Bezirke
 * by name. All data points share the same `data_sources` row (the 2025
 * publication, which collects the historical series).
 *
 * Run with:
 *   npm run ingest:berlin-ibb
 *
 * Idempotent: re-running overwrites identical rows in place.
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
    "Median Angebotsmiete (Nettokaltmiete in EUR/m²/Monat) pro Berliner Bezirk, jährliche Werte 2012–2025. Datenbasis: VALUE Marktdatenbank (Online-Inserate).",
};

const METRIC = "angebotsmiete_median_eur_per_sqm";
const FIRST_YEAR = 2012;
const LAST_YEAR = 2025;

// The 12 modern Berliner Bezirke (post-2001 reform). Used to filter out
// any historical-aggregation rows in older sheets that don't match the
// current administrative names.
const BEZIRK_NAMES = new Set([
  "Mitte",
  "Friedrichshain-Kreuzberg",
  "Pankow",
  "Charlottenburg-Wilmersdorf",
  "Spandau",
  "Steglitz-Zehlendorf",
  "Tempelhof-Schöneberg",
  "Neukölln",
  "Treptow-Köpenick",
  "Marzahn-Hellersdorf",
  "Lichtenberg",
  "Reinickendorf",
]);

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

  // Resolve district UUIDs by name once.
  const { data: districts, error: dErr } = await supabase
    .from("districts")
    .select("id, name")
    .eq("city_id", "berlin")
    .eq("level", "bezirk");
  if (dErr) throw dErr;
  const idByName = new Map((districts ?? []).map((d) => [d.name, d.id]));
  if (idByName.size !== 12) {
    throw new Error(
      `Expected 12 Berlin Bezirke in DB, found ${idByName.size}. Run berlin-districts.ts first.`,
    );
  }

  console.log(`Upserting source '${SOURCE.id}' ...`);
  const { error: srcErr } = await supabase
    .from("data_sources")
    .upsert(SOURCE, { onConflict: "id" });
  if (srcErr) throw srcErr;

  let totalRows = 0;
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const sheetName = `Bezirksdaten_${year}`;
    const sheet = wb.getWorksheet(sheetName);
    if (!sheet) {
      console.warn(`  ! sheet "${sheetName}" not found, skipping`);
      continue;
    }

    const records = extractYear(sheet, year);
    if (records.length !== 12) {
      console.warn(
        `  ! ${year}: expected 12 Bezirke, got ${records.length} — skipping`,
      );
      continue;
    }

    const periodStart = `${year}-01-01`;
    const periodEnd = `${year}-12-31`;

    for (const rec of records) {
      const districtId = idByName.get(rec.name);
      if (!districtId) {
        throw new Error(`No matching district for "${rec.name}"`);
      }
      const { error } = await supabase.rpc("upsert_rent_data_point", {
        p_source_id: SOURCE.id,
        p_district_id: districtId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_metric: METRIC,
        p_value_median: rec.median,
        p_sample_size: rec.sampleSize,
      });
      if (error) {
        throw new Error(
          `${year} / ${rec.name}: ${error.message}`,
        );
      }
      totalRows += 1;
    }

    const min = Math.min(...records.map((r) => r.median));
    const max = Math.max(...records.map((r) => r.median));
    console.log(
      `  + ${year}  (12 Bezirke, range ${min.toFixed(2)}–${max.toFixed(2)} €/m²)`,
    );
  }

  console.log(
    `\nDone. Upserted ${totalRows} rent data points across ${LAST_YEAR - FIRST_YEAR + 1} years.`,
  );
}

function extractYear(sheet: ExcelJS.Worksheet, year: number): BezirkRow[] {
  const records: BezirkRow[] = [];
  const seen = new Set<string>();
  sheet.eachRow((row) => {
    const name = String(row.getCell(3).value ?? "").trim();
    if (!BEZIRK_NAMES.has(name)) return;
    if (seen.has(name)) return; // first occurrence wins (defensive)
    seen.add(name);

    const median = toNumber(row.getCell(5).value);
    const sampleSize = toInteger(row.getCell(7).value);
    if (median === null || sampleSize === null) {
      throw new Error(
        `${year} / ${name}: missing median or sample size (median=${median} n=${sampleSize})`,
      );
    }
    records.push({ name, median, sampleSize });
  });
  return records;
}

function toNumber(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    // Some cells contain rich-text multi-line summaries (e.g. 2021 / Mitte
    // has all 12 medians stuffed into one cell). Take the first line only.
    const firstLine = v.split(/\r?\n/)[0].trim();
    const n = Number(firstLine.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (v && typeof v === "object") {
    if ("richText" in v) {
      const fragments = (v as { richText: { text?: string }[] }).richText;
      const first = fragments?.[0]?.text ?? "";
      return toNumber(first);
    }
    if ("result" in v) {
      return toNumber((v as { result: ExcelJS.CellValue }).result);
    }
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
