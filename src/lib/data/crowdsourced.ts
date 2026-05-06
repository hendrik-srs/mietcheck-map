import { createAdminClient } from "@/lib/supabase/admin";

export type BuildingAgeBracket =
  | "vor_1949"
  | "1949_1990"
  | "1991_2010"
  | "nach_2010";

export const buildingAgeLabels: Record<BuildingAgeBracket, string> = {
  vor_1949: "Vor 1949 (Altbau)",
  "1949_1990": "1949 – 1990",
  "1991_2010": "1991 – 2010",
  nach_2010: "Nach 2010 (Neubau)",
};

interface SubmitArgs {
  districtId: string;
  sizeSqm: number;
  monthlyRentEur: number;
  buildingAgeBracket: BuildingAgeBracket | null;
}

export async function submitCrowdsourcedRent(args: SubmitArgs): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("submit_crowdsourced_rent", {
    p_district_id: args.districtId,
    p_size_sqm: args.sizeSqm,
    p_monthly_rent_eur: args.monthlyRentEur,
    p_building_age_bracket: args.buildingAgeBracket,
  });
  if (error) throw error;
  return data as string;
}
