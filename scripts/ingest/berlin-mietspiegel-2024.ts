/**
 * Ingestion: Berliner Mietspiegel 2024 — 163 Tabellenzeilen
 *
 * Source: https://www.berlin.de/sen/wohnen/_assets/service/mietspiegel2024.pdf
 * Lizenz: amtliches Werk, gemeinfrei nach §5 UrhG
 *
 * Die Werte sind aus dem PDF extrahiert (siehe
 * `scripts/ingest/data/berlin-mietspiegel-2024.json`) und werden über
 * `upsert_berlin_mietspiegel_2024_batch` idempotent eingespielt.
 *
 * Run with:
 *   npm run ingest:berlin-mietspiegel-2024
 *
 * Requires:
 *   - .env.local mit NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY
 *   - Migration 20260506_0010_berlin_mietspiegel_2024.sql applied
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "data", "berlin-mietspiegel-2024.json");

const SOURCE = {
  id: "berlin_mietspiegel_2024",
  name: "Berliner Mietspiegel 2024",
  publisher: "Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin",
  source_url:
    "https://www.berlin.de/sen/wohnen/_assets/service/mietspiegel2024.pdf",
  license: "Amtliches Werk – gemeinfrei (§5 UrhG)",
  source_type: "mietspiegel" as const,
  reference_date: "2023-09-01",
  notes:
    "Berliner Mietspiegel 2024, Stichtag 01.09.2023. 163 Tabellenzeilen für ortsübliche Vergleichsmieten (Nettokalt, EUR/m²/Monat) nach Wohnlage, Bezugsfertigkeit und Wohnfläche.",
};

interface MietspiegelRow {
  zeile_nr: number;
  wohnlage: "einfach" | "mittel" | "gut";
  baualter_label: string;
  baualter_year_min: number | null;
  baualter_year_max: number | null;
  west_ost: "west" | "ost" | null;
  size_sqm_label: string;
  size_sqm_min: number | null;
  size_sqm_max: number | null;
  value_lower_eur_per_sqm: number | null;
  value_median_eur_per_sqm: number | null;
  value_upper_eur_per_sqm: number | null;
  sample_too_small: boolean;
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

  console.log(`Reading ${DATA_PATH} ...`);
  const raw = readFileSync(DATA_PATH, "utf8");
  const rows = JSON.parse(raw) as MietspiegelRow[];
  console.log(`  -> ${rows.length} rows`);

  if (rows.length !== 163) {
    console.warn(
      `Expected 163 rows in Mietspiegel 2024, got ${rows.length}. Continuing anyway.`,
    );
  }

  console.log(`Upserting data source '${SOURCE.id}' ...`);
  {
    const { error } = await supabase
      .from("data_sources")
      .upsert(SOURCE, { onConflict: "id" });
    if (error) throw error;
  }

  console.log(`Upserting ${rows.length} Mietspiegel rows ...`);
  const { data, error } = await supabase.rpc(
    "upsert_berlin_mietspiegel_2024_batch",
    { p_rows: rows },
  );
  if (error) {
    throw new Error(`Batch upsert failed: ${error.message}`);
  }

  const affected = typeof data === "number" ? data : rows.length;
  console.log(
    `\nDone. ${affected} rows upserted into 'berlin_mietspiegel_2024'.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
