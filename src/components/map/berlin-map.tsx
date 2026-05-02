"use client";

import dynamic from "next/dynamic";

import type { DistrictsFeatureCollection } from "@/lib/data/districts";

// MapLibre touches `window` at import time — defer to client-only render.
const MapInner = dynamic(() => import("./berlin-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Karte wird geladen …
    </div>
  ),
});

export function BerlinMap({
  districts,
}: {
  districts: DistrictsFeatureCollection;
}) {
  return <MapInner districts={districts} />;
}
