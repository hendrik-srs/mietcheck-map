"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useCallback, useState } from "react";
import {
  Layer,
  Map,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DistrictsFeatureCollection } from "@/lib/data/districts";

const FILL_LAYER: LayerProps = {
  id: "districts-fill",
  type: "fill",
  paint: {
    "fill-color": "#3b82f6",
    "fill-opacity": 0.18,
  },
};

const LINE_LAYER: LayerProps = {
  id: "districts-line",
  type: "line",
  paint: {
    "line-color": "#1e3a8a",
    "line-width": 1.2,
  },
};

const LABEL_LAYER: LayerProps = {
  id: "districts-label",
  type: "symbol",
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Regular"],
    "text-size": 12,
    "text-allow-overlap": false,
  },
  paint: {
    "text-color": "#0f172a",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

interface SelectedDistrict {
  id: string;
  name: string;
  level: string;
}

export default function BerlinMapInner({
  districts,
}: {
  districts: DistrictsFeatureCollection;
}) {
  const [selected, setSelected] = useState<SelectedDistrict | null>(null);
  const [cursor, setCursor] = useState<"auto" | "pointer">("auto");

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const props = feature.properties ?? {};
    setSelected({
      id: String(props.id ?? feature.id),
      name: String(props.name ?? "Unbekannter Bezirk"),
      level: String(props.level ?? "bezirk"),
    });
  }, []);

  return (
    <>
      <Map
        initialViewState={{ longitude: 13.405, latitude: 52.52, zoom: 9.4 }}
        minZoom={8}
        maxZoom={16}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/positron"
        interactiveLayerIds={[FILL_LAYER.id!]}
        onClick={onClick}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("auto")}
        cursor={cursor}
      >
        <Source id="districts" type="geojson" data={districts}>
          <Layer {...FILL_LAYER} />
          <Layer {...LINE_LAYER} />
          <Layer {...LABEL_LAYER} />
        </Source>
      </Map>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>Bezirk in Berlin</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6 text-sm">
                <div className="rounded-lg border bg-muted/40 p-4 text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Mietspiegel-Daten folgen.
                  </p>
                  <p className="mt-1">
                    In der nächsten Iteration laden wir die
                    Mietspiegel-2024-Daten der Senatsverwaltung pro Bezirk und
                    färben die Karte als Heatmap ein.
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <dt>Ebene</dt>
                  <dd className="col-span-2 text-foreground">{selected.level}</dd>
                  <dt>Quelle</dt>
                  <dd className="col-span-2 text-foreground">
                    Geoportal Berlin
                  </dd>
                </dl>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
