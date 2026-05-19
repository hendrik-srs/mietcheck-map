import { ImageResponse } from "next/og";

import { getDistrictsGeoJSON } from "@/lib/data/districts";
import { BERLIN_BEZIRKE, bezirkNameForSlug } from "@/lib/slugs";

// Node runtime instead of edge so we can re-use the existing Supabase
// server client. The OG image is rebuilt at most once per ISR-revalidate
// (24 h) so the per-call cost is irrelevant.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "MietCheck Map Bezirks-Übersicht";

export function generateImageMetadata() {
  return BERLIN_BEZIRKE.map(({ slug }) => ({
    id: slug,
    alt: `Mieten in ${BERLIN_BEZIRKE.find((b) => b.slug === slug)?.name}`,
    size,
    contentType,
  }));
}

const eur = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const name = bezirkNameForSlug(params.slug) ?? "Berlin";

  let medianStr: string | null = null;
  let lastYear: string | null = null;
  try {
    const fc = await getDistrictsGeoJSON("berlin");
    const props = fc.features.find((f) => f.properties.name === name)?.properties;
    if (props?.rent_median != null) {
      medianStr = `${eur(props.rent_median)} / m²`;
    }
    if (props?.rent_period_end) {
      lastYear = props.rent_period_end.slice(0, 4);
    }
  } catch {
    // If DB call fails at edge runtime, fall back to a name-only card —
    // better than a broken image.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #f0f9ff 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#0f172a",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            M
          </div>
          <div style={{ fontSize: 24, color: "#475569", fontWeight: 500 }}>
            MietCheck Map
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 20,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: 600,
            }}
          >
            Berlin · Bezirk
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            {name}
          </div>
          {medianStr && (
            <div
              style={{
                marginTop: 16,
                fontSize: 40,
                color: "#1e293b",
                display: "flex",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <span style={{ color: "#0ea5e9", fontWeight: 600 }}>
                {medianStr}
              </span>
              <span style={{ fontSize: 24, color: "#64748b" }}>
                Angebotsmiete{lastYear ? ` · Stand ${lastYear}` : ""}
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 20,
            color: "#64748b",
          }}
        >
          <span>
            Offizielle Quellen · IBB · Mietspiegel 2024 · Geoportal Berlin
          </span>
          <span style={{ fontWeight: 500 }}>mietcheck-map.vercel.app</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
