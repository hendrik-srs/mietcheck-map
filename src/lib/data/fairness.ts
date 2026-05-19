import { createClient } from "@/lib/supabase/server";

export interface DistrictRentLookup {
  /**
   * Feinster passender Treffer für die Adresse — kann ein Ortsteil sein
   * (level='ortsteil') oder, falls keine Ortsteile ingestiert sind, ein
   * Bezirk (level='bezirk').
   */
  districtId: string;
  districtName: string;
  districtLevel: "bezirk" | "ortsteil" | "plz";
  /**
   * Bezirk, in dem der Treffer liegt. Bei Bezirks-Treffer identisch mit
   * districtId/Name. Rent-Daten beziehen sich immer auf diese Granularität.
   */
  parentDistrictId: string;
  parentDistrictName: string;
  rentMedian: number | null;
  rentSampleSize: number | null;
  rentPeriodStart: string | null;
  rentPeriodEnd: string | null;
  rentMetric: string | null;
  rentSourceId: string | null;
  rentSourceName: string | null;
  rentSourcePublisher: string | null;
  rentSourceUrl: string | null;
  /** "einfach" / "mittel" / "gut" — null wenn berlin_wohnlagen leer ist */
  wohnlage: "einfach" | "mittel" | "gut" | null;
  wohnlageStrasse: string | null;
  wohnlageHausnummer: string | null;
  wohnlagePlz: string | null;
  /** Distanz in Metern zur nächsten klassifizierten Adresse */
  wohnlageDistanceM: number | null;
}

interface RpcRow {
  district_id: string;
  district_name: string;
  district_level: "bezirk" | "ortsteil" | "plz";
  parent_district_id: string;
  parent_district_name: string;
  rent_median: number | string | null;
  rent_sample_size: number | null;
  rent_period_start: string | null;
  rent_period_end: string | null;
  rent_metric: string | null;
  rent_source_id: string | null;
  rent_source_name: string | null;
  rent_source_publisher: string | null;
  rent_source_url: string | null;
  wohnlage: "einfach" | "mittel" | "gut" | null;
  wohnlage_strasse: string | null;
  wohnlage_hausnummer: string | null;
  wohnlage_plz: string | null;
  wohnlage_distance_m: number | string | null;
}

export async function findDistrictByPoint(
  cityId: string,
  lon: number,
  lat: number,
): Promise<DistrictRentLookup | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_district_by_point", {
    p_city_id: cityId,
    p_lon: lon,
    p_lat: lat,
  });
  if (error) throw error;

  const rows = data as RpcRow[] | null;
  if (!rows || rows.length === 0) return null;

  const row = rows[0];
  return {
    districtId: row.district_id,
    districtName: row.district_name,
    districtLevel: row.district_level,
    parentDistrictId: row.parent_district_id,
    parentDistrictName: row.parent_district_name,
    rentMedian: row.rent_median == null ? null : Number(row.rent_median),
    rentSampleSize: row.rent_sample_size,
    rentPeriodStart: row.rent_period_start,
    rentPeriodEnd: row.rent_period_end,
    rentMetric: row.rent_metric,
    rentSourceId: row.rent_source_id,
    rentSourceName: row.rent_source_name,
    rentSourcePublisher: row.rent_source_publisher,
    rentSourceUrl: row.rent_source_url,
    wohnlage: row.wohnlage,
    wohnlageStrasse: row.wohnlage_strasse,
    wohnlageHausnummer: row.wohnlage_hausnummer,
    wohnlagePlz: row.wohnlage_plz,
    wohnlageDistanceM:
      row.wohnlage_distance_m == null ? null : Number(row.wohnlage_distance_m),
  };
}

export type Verdict = "guenstig" | "marktueblich" | "ueber_markt" | "weit_ueber_markt";

export interface FairnessAssessment {
  pricePerSqm: number;
  comparisonMedian: number;
  deviationPct: number;          // ((price - median) / median) * 100
  monthlyOverpay: number;        // (price - median) * sqm, may be negative
  yearlyOverpay: number;
  verdict: Verdict;
  verdictLabel: string;
  verdictDescription: string;
}

export function assessFairness(
  monthlyRentEur: number,
  sizeSqm: number,
  comparisonMedianEurPerSqm: number,
): FairnessAssessment {
  const pricePerSqm = monthlyRentEur / sizeSqm;
  const deviationPct =
    ((pricePerSqm - comparisonMedianEurPerSqm) / comparisonMedianEurPerSqm) * 100;
  const monthlyOverpay = (pricePerSqm - comparisonMedianEurPerSqm) * sizeSqm;
  const yearlyOverpay = monthlyOverpay * 12;

  let verdict: Verdict;
  let verdictLabel: string;
  let verdictDescription: string;

  if (deviationPct < -5) {
    verdict = "guenstig";
    verdictLabel = "Günstig";
    verdictDescription =
      "Deine Miete liegt deutlich unter dem Bezirks-Median. Glück gehabt — oder du hast gut verhandelt.";
  } else if (deviationPct <= 5) {
    verdict = "marktueblich";
    verdictLabel = "Marktüblich";
    verdictDescription =
      "Deine Miete liegt im üblichen Rahmen für deinen Bezirk. Der Markt-Median selbst kann allerdings hoch sein.";
  } else if (deviationPct <= 15) {
    verdict = "ueber_markt";
    verdictLabel = "Über dem Markt";
    verdictDescription =
      "Deine Miete liegt über dem Bezirks-Median. Eine genaue Mietspiegel-Prüfung kann sich lohnen.";
  } else {
    verdict = "weit_ueber_markt";
    verdictLabel = "Deutlich über dem Markt";
    verdictDescription =
      "Deine Miete liegt klar über dem Bezirks-Median. Mietpreisbremse-Prüfung dringend empfohlen.";
  }

  return {
    pricePerSqm,
    comparisonMedian: comparisonMedianEurPerSqm,
    deviationPct,
    monthlyOverpay,
    yearlyOverpay,
    verdict,
    verdictLabel,
    verdictDescription,
  };
}
