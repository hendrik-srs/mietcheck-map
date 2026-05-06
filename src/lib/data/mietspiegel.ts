import { createClient } from "@/lib/supabase/server";

export interface MietspiegelRow {
  zeileNr: number;
  wohnlage: "einfach" | "mittel" | "gut";
  baualterLabel: string;
  sizeSqmLabel: string;
  westOst: "west" | "ost" | null;
  valueLowerEurPerSqm: number;
  valueMedianEurPerSqm: number;
  valueUpperEurPerSqm: number;
  sampleTooSmall: boolean;
}

interface RpcRow {
  zeile_nr: number;
  wohnlage: "einfach" | "mittel" | "gut";
  baualter_label: string;
  size_sqm_label: string;
  west_ost: "west" | "ost" | null;
  value_lower_eur_per_sqm: number | string | null;
  value_median_eur_per_sqm: number | string | null;
  value_upper_eur_per_sqm: number | string | null;
  sample_too_small: boolean;
}

export async function findMietspiegelRow(
  wohnlage: "einfach" | "mittel" | "gut",
  baujahr: number,
  sizeSqm: number,
  westOst: "west" | "ost" | null = null,
): Promise<MietspiegelRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_mietspiegel_2024_row", {
    p_wohnlage: wohnlage,
    p_baujahr: baujahr,
    p_size_sqm: sizeSqm,
    p_west_ost: westOst,
  });
  if (error) throw error;

  const rows = data as RpcRow[] | null;
  if (!rows || rows.length === 0) return null;

  const r = rows[0];
  if (
    r.value_lower_eur_per_sqm == null ||
    r.value_median_eur_per_sqm == null ||
    r.value_upper_eur_per_sqm == null
  ) {
    return null;
  }

  return {
    zeileNr: r.zeile_nr,
    wohnlage: r.wohnlage,
    baualterLabel: r.baualter_label,
    sizeSqmLabel: r.size_sqm_label,
    westOst: r.west_ost,
    valueLowerEurPerSqm: Number(r.value_lower_eur_per_sqm),
    valueMedianEurPerSqm: Number(r.value_median_eur_per_sqm),
    valueUpperEurPerSqm: Number(r.value_upper_eur_per_sqm),
    sampleTooSmall: r.sample_too_small,
  };
}

export type MietspiegelVerdict =
  | "unter_spanne"
  | "in_spanne_unten"
  | "in_spanne_mitte"
  | "in_spanne_oben"
  | "ueber_spanne"
  | "ueber_mietpreisbremse";

export interface MietspiegelAssessment {
  pricePerSqm: number;
  row: MietspiegelRow;
  /** Mittelwert × 1.10 — die typische Mietpreisbremsen-Schwelle */
  mietpreisbremseLimitEurPerSqm: number;
  /** Differenz pro m² zum Mittelwert */
  deviationFromMedianEurPerSqm: number;
  /** monatlich ggü. Mittelwert (positiv = User zahlt mehr) */
  monthlyDeviationFromMedian: number;
  yearlyDeviationFromMedian: number;
  verdict: MietspiegelVerdict;
  verdictLabel: string;
  verdictDescription: string;
  /** True wenn die Miete > Mittelwert+10% liegt — möglicher Mietpreisbremsen-Fall */
  potentialMietpreisbremseViolation: boolean;
}

export function assessMietspiegel(
  monthlyRentEur: number,
  sizeSqm: number,
  row: MietspiegelRow,
): MietspiegelAssessment {
  const pricePerSqm = monthlyRentEur / sizeSqm;
  const lower = row.valueLowerEurPerSqm;
  const median = row.valueMedianEurPerSqm;
  const upper = row.valueUpperEurPerSqm;
  const mietpreisbremseLimit = median * 1.1;

  const deviationFromMedian = pricePerSqm - median;
  const monthlyDeviationFromMedian = deviationFromMedian * sizeSqm;
  const yearlyDeviationFromMedian = monthlyDeviationFromMedian * 12;

  let verdict: MietspiegelVerdict;
  let verdictLabel: string;
  let verdictDescription: string;

  if (pricePerSqm < lower) {
    verdict = "unter_spanne";
    verdictLabel = "Unter dem Mietspiegel";
    verdictDescription =
      "Deine Miete liegt unter der unteren Spanne des Mietspiegels für diesen Wohnungstyp.";
  } else if (pricePerSqm > upper) {
    verdict = "ueber_spanne";
    verdictLabel = "Über der oberen Spanne";
    verdictDescription =
      "Deine Miete liegt über der oberen Mietspiegel-Spanne. Eine Mietpreisbremsen-Prüfung ist dringend angezeigt.";
  } else if (pricePerSqm > mietpreisbremseLimit) {
    verdict = "ueber_mietpreisbremse";
    verdictLabel = "Über Mittelwert + 10 %";
    verdictDescription =
      "Deine Miete liegt zwischen Mittelwert + 10 % und der oberen Spanne. Je nach Ausstattung kann das ein Mietpreisbremsen-Verstoß sein.";
  } else if (pricePerSqm < median) {
    verdict = "in_spanne_unten";
    verdictLabel = "In der unteren Spanne";
    verdictDescription =
      "Deine Miete liegt zwischen unterer Spanne und Mittelwert — typisch für Wohnungen mit weniger guter Ausstattung.";
  } else if (Math.abs(pricePerSqm - median) / median <= 0.05) {
    verdict = "in_spanne_mitte";
    verdictLabel = "Am Mittelwert";
    verdictDescription =
      "Deine Miete liegt nahe dem Mietspiegel-Mittelwert für diesen Wohnungstyp.";
  } else {
    verdict = "in_spanne_oben";
    verdictLabel = "Im oberen Drittel der Spanne";
    verdictDescription =
      "Deine Miete liegt zwischen Mittelwert und Mittelwert + 10 % — meist innerhalb der Mietpreisbremse.";
  }

  return {
    pricePerSqm,
    row,
    mietpreisbremseLimitEurPerSqm: mietpreisbremseLimit,
    deviationFromMedianEurPerSqm: deviationFromMedian,
    monthlyDeviationFromMedian,
    yearlyDeviationFromMedian,
    verdict,
    verdictLabel,
    verdictDescription,
    potentialMietpreisbremseViolation: pricePerSqm > mietpreisbremseLimit,
  };
}

/**
 * Konservativer West/Ost-Default für 1973–1990 ohne Adress-Lookup im
 * Straßenverzeichnis. Bezirke laut Gebietsstand vor der Reform 31.12.2000:
 * Friedrichshain, Hellersdorf, Hohenschönhausen, Köpenick, Lichtenberg,
 * Marzahn, Mitte (Ost-Teil), Pankow, Prenzlauer Berg, Treptow, Weißensee.
 * Alles andere ist West (inkl. West-Staaken-Sonderfall, der hier ignoriert
 * wird — siehe Roadmap Phase 2.2b).
 */
const OST_BEZIRKE_PRE_2001 = new Set([
  "friedrichshain-kreuzberg", // Friedrichshain-Anteil; konservativ Ost
  "lichtenberg",
  "marzahn-hellersdorf",
  "pankow",
  "treptow-köpenick",
]);

export function inferWestOstFromBezirk(bezirkName: string): "west" | "ost" {
  const normalized = bezirkName.trim().toLowerCase();
  return OST_BEZIRKE_PRE_2001.has(normalized) ? "ost" : "west";
}
