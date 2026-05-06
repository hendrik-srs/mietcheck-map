"use server";

import { z } from "zod";

import { findDistrictByPoint, assessFairness } from "@/lib/data/fairness";
import { submitCrowdsourcedRent } from "@/lib/data/crowdsourced";
import { geocodeAddressInBerlin } from "@/lib/geocoding";
import type { FairnessAssessment, DistrictRentLookup } from "@/lib/data/fairness";
import type { BuildingAgeBracket } from "@/lib/data/crowdsourced";

const buildingAgeValues = ["vor_1949", "1949_1990", "1991_2010", "nach_2010"] as const;

const schema = z.object({
  address: z.string().trim().min(5, "Bitte vollständige Adresse eingeben."),
  sizeSqm: z.coerce
    .number()
    .gt(5, "Wohnfläche zu klein.")
    .lt(1000, "Wohnfläche zu groß."),
  monthlyRent: z.coerce
    .number()
    .gt(50, "Miete zu niedrig.")
    .lt(20000, "Miete zu hoch."),
  buildingAge: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.enum(buildingAgeValues).optional(),
  ),
});

type FormValues = {
  address: string;
  sizeSqm: string;
  monthlyRent: string;
  buildingAge: string;
  share: boolean;
};

export interface CheckFormState {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<"address" | "sizeSqm" | "monthlyRent" | "_form", string>>;
  // Echo back what the user typed so the form keeps its values after a failed submit.
  values?: FormValues;
  result?: {
    address: string;
    displayName: string;
    sizeSqm: number;
    monthlyRent: number;
    district: DistrictRentLookup;
    assessment: FairnessAssessment;
    shared: boolean;
  };
}

export async function runFairnessCheck(
  _prev: CheckFormState,
  formData: FormData,
): Promise<CheckFormState> {
  const rawShare = formData.get("share");
  const rawBuildingAge = formData.get("buildingAge");
  const raw = {
    address: String(formData.get("address") ?? ""),
    sizeSqm: String(formData.get("sizeSqm") ?? ""),
    monthlyRent: String(formData.get("monthlyRent") ?? ""),
    buildingAge: typeof rawBuildingAge === "string" ? rawBuildingAge : "",
    share: rawShare === "on" || rawShare === "true",
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    return {
      status: "error",
      values: raw,
      errors: {
        address: flat.address?.[0],
        sizeSqm: flat.sizeSqm?.[0],
        monthlyRent: flat.monthlyRent?.[0],
      },
    };
  }

  const { address, sizeSqm, monthlyRent } = parsed.data;
  const buildingAge: BuildingAgeBracket | null = parsed.data.buildingAge ?? null;

  let geocoded;
  try {
    geocoded = await geocodeAddressInBerlin(address);
  } catch (e) {
    console.error("[check] geocoding error", e);
    return {
      status: "error",
      values: raw,
      errors: { _form: "Geocoding-Dienst gerade nicht erreichbar. Bitte später erneut versuchen." },
    };
  }

  if (!geocoded) {
    return {
      status: "error",
      values: raw,
      errors: { address: "Adresse nicht gefunden. Bitte Straße, Hausnummer und PLZ prüfen." },
    };
  }

  let district;
  try {
    district = await findDistrictByPoint("berlin", geocoded.lon, geocoded.lat);
  } catch (e) {
    console.error("[check] district lookup error", e);
    return {
      status: "error",
      values: raw,
      errors: { _form: "Bezirks-Lookup fehlgeschlagen. Bitte später erneut versuchen." },
    };
  }

  if (!district) {
    return {
      status: "error",
      values: raw,
      errors: {
        address:
          "Diese Adresse liegt außerhalb von Berlin. Andere Städte folgen — siehe Roadmap.",
      },
    };
  }

  if (district.rentMedian == null) {
    return {
      status: "error",
      values: raw,
      errors: {
        _form: `Für ${district.districtName} liegen aktuell keine Vergleichsmieten vor.`,
      },
    };
  }

  const assessment = assessFairness(monthlyRent, sizeSqm, district.rentMedian);

  let shared = false;
  if (raw.share) {
    try {
      await submitCrowdsourcedRent({
        districtId: district.districtId,
        sizeSqm,
        monthlyRentEur: monthlyRent,
        buildingAgeBracket: buildingAge,
      });
      shared = true;
    } catch (e) {
      // Submission is opt-in and best-effort. A failure here must not break
      // the user's verdict, so we log and surface a silent shared=false.
      console.error("[check] crowdsourced submission failed", e);
    }
  }

  return {
    status: "success",
    result: {
      address,
      displayName: geocoded.displayName,
      sizeSqm,
      monthlyRent,
      district,
      assessment,
      shared,
    },
  };
}
