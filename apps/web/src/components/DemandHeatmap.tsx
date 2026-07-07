"use client";

import { useEffect, useMemo, useState } from "react";
import Map, { Layer, Source, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchHotspots } from "@/lib/api-mock";
import { MOCK_WARDS } from "@/lib/mock-data";
import { THEME_COLORS, THEME_LABELS } from "@/lib/constants";
import type { ThemeKey } from "@/types";

// ── Free tile style (CARTO Positron — no token required) ──────────────────────
const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// ── Ward GeoJSON polygons (approximate bounding boxes for demo data) ──────────
// In production these would come from a real admin-boundaries API/file.
// Each polygon is a rough rectangle around the ward's mock submission cluster.
const WARD_POLYGONS: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { ward_id: "ward-01", name: "Ward 1 — Central" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.198, 28.612], [77.208, 28.612],
          [77.208, 28.620], [77.198, 28.620], [77.198, 28.612],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { ward_id: "ward-02", name: "Ward 2 — North" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.195, 28.602], [77.208, 28.602],
          [77.208, 28.613], [77.195, 28.613], [77.195, 28.602],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { ward_id: "ward-03", name: "Ward 3 — East" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.204, 28.610], [77.222, 28.610],
          [77.222, 28.625], [77.204, 28.625], [77.204, 28.610],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { ward_id: "ward-04", name: "Ward 4 — South" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.200, 28.614], [77.210, 28.614],
          [77.210, 28.622], [77.200, 28.622], [77.200, 28.614],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { ward_id: "ward-05", name: "Ward 5 — West" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.207, 28.623], [77.224, 28.623],
          [77.224, 28.633], [77.207, 28.633], [77.207, 28.623],
        ]],
      },
    },
  ],
};

// ── Submission-count per ward (from MOCK_WARDS) ────────────────────────────────
const WARD_COUNTS: Record<string, number> = Object.fromEntries(
  MOCK_WARDS.map((w) => [w.id, w.submission_count])
);
const MAX_COUNT = Math.max(...MOCK_WARDS.map((w) => w.submission_count));

// Inject submission_count into polygon properties for paint expressions
const wardGeoWithCounts: GeoJSON.FeatureCollection = {
  ...WARD_POLYGONS,
  features: WARD_POLYGONS.features.map((f) => ({
    ...f,
    properties: {
      ...f.properties,
      submission_count: WARD_COUNTS[f.properties!.ward_id] ?? 0,
    },
  })),
};

const THEMES: { key: ThemeKey | "all"; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "schools",     label: "Schools" },
  { key: "roads",       label: "Roads" },
  { key: "water",       label: "Water" },
  { key: "health",      label: "Health" },
  { key: "electricity", label: "Electricity" },
];

interface PopupInfo {
  lng: number;
  lat: number;
  theme: ThemeKey;
  ward_name: string;
  urgency: number;
}

interface WardInfo {
  ward_id: string;
  name: string;
}

export default function DemandHeatmap() {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [activeTheme, setActiveTheme] = useState<ThemeKey | "all">("all");
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [hoveredWard, setHoveredWard] = useState<WardInfo | null>(null);

  useEffect(() => {
    fetchHotspots().then(setGeoData);
  }, []);

  // Filter hotspot points by selected theme
  const filteredGeo = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!geoData) return { type: "FeatureCollection", features: [] };
    return {
      ...geoData,
      features:
        activeTheme === "all"
          ? geoData.features
          : geoData.features.filter(
              (f) => f.properties?.theme === activeTheme
            ),
    };
  }, [geoData, activeTheme]);

  // Ward detail for hover sidebar
  const hoveredWardData = hoveredWard
    ? MOCK_WARDS.find((w) => w.id === hoveredWard.ward_id)
    : null;

  return (
    <div className="rounded-2xl border-2 border-gray-200 overflow-hidden shadow-soft-lg bg-white">

      {/* Theme filter tabs */}
      <div className="flex gap-1.5 p-3 border-b border-gray-100 overflow-x-auto">
        {THEMES.map(({ key, label }) => {
          const active = activeTheme === key;
          const color = key === "all" ? "#3b82f6" : THEME_COLORS[key as ThemeKey];
          return (
            <button
              key={key}
              onClick={() => setActiveTheme(key)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                active
                  ? "text-white border-transparent shadow-sm"
                  : "text-gray-600 border-gray-200 bg-white hover:bg-gray-50"
              }`}
              style={active ? { background: color, borderColor: color } : {}}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div className="relative" style={{ height: 340 }}>
        <Map
          initialViewState={{ longitude: 77.209, latitude: 28.617, zoom: 12.2 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLE}
          interactiveLayerIds={["ward-fill", "hotspot-circles"]}
          onMouseMove={(e) => {
            const features = e.features ?? [];
            const ward = features.find((f) => f.layer.id === "ward-fill");
            if (ward) {
              setHoveredWard({
                ward_id: ward.properties?.ward_id,
                name: ward.properties?.name,
              });
            } else {
              setHoveredWard(null);
            }
          }}
          onMouseLeave={() => setHoveredWard(null)}
          onClick={(e) => {
            const features = e.features ?? [];
            const dot = features.find((f) => f.layer.id === "hotspot-circles");
            if (dot) {
              const coords = (dot.geometry as GeoJSON.Point).coordinates as [number, number];
              setPopup({
                lng: coords[0],
                lat: coords[1],
                theme: dot.properties?.theme,
                ward_name: dot.properties?.ward_id
                  ?.replace("ward-0", "Ward ")
                  ?.replace("ward-", "Ward ") ?? "—",
                urgency: dot.properties?.urgency_score,
              });
            } else {
              setPopup(null);
            }
          }}
        >
          {/* ── Ward choropleth fill (submission density) ── */}
          <Source id="wards" type="geojson" data={wardGeoWithCounts}>
            <Layer
              id="ward-fill"
              type="fill"
              paint={{
                "fill-color": [
                  "interpolate", ["linear"],
                  ["get", "submission_count"],
                  0,  "#dbeafe",
                  10, "#93c5fd",
                  20, "#3b82f6",
                  35, "#1d4ed8",
                  50, "#1e3a8a",
                ],
                "fill-opacity": 0.35,
              }}
            />
            <Layer
              id="ward-outline"
              type="line"
              paint={{
                "line-color": "#1d4ed8",
                "line-width": 1.5,
                "line-opacity": 0.6,
              }}
            />
          </Source>

          {/* ── Hotspot heatmap layer ── */}
          <Source id="hotspots-heat" type="geojson" data={filteredGeo}>
            <Layer
              id="heatmap-layer"
              type="heatmap"
              paint={{
                "heatmap-weight": [
                  "interpolate", ["linear"],
                  ["get", "urgency_score"], 0, 0, 1, 1,
                ],
                "heatmap-intensity": [
                  "interpolate", ["linear"], ["zoom"], 11, 1, 14, 3,
                ],
                "heatmap-color": [
                  "interpolate", ["linear"], ["heatmap-density"],
                  0,   "rgba(59,130,246,0)",
                  0.2, "rgba(59,130,246,0.5)",
                  0.5, "rgba(251,191,36,0.75)",
                  0.8, "rgba(239,68,68,0.9)",
                  1,   "rgba(185,28,28,1)",
                ],
                "heatmap-radius": [
                  "interpolate", ["linear"], ["zoom"], 11, 40, 15, 80,
                ],
                "heatmap-opacity": 0.75,
              }}
            />
          </Source>

          {/* ── Individual submission circles (visible on zoom-in) ── */}
          <Source id="hotspots" type="geojson" data={filteredGeo}>
            <Layer
              id="hotspot-circles"
              type="circle"
              minzoom={12}
              paint={{
                "circle-radius": [
                  "interpolate", ["linear"], ["zoom"], 12, 5, 15, 10,
                ],
                "circle-color": [
                  "match", ["get", "theme"],
                  "schools",     THEME_COLORS.schools,
                  "roads",       THEME_COLORS.roads,
                  "water",       THEME_COLORS.water,
                  "health",      THEME_COLORS.health,
                  "electricity", THEME_COLORS.electricity,
                  "#6b7280",
                ],
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
                "circle-opacity": 0.9,
              }}
            />
          </Source>

          {/* ── Popup on dot click ── */}
          {popup && (
            <Popup
              longitude={popup.lng}
              latitude={popup.lat}
              anchor="bottom"
              onClose={() => setPopup(null)}
              closeButton
              closeOnClick={false}
              style={{ zIndex: 10 }}
            >
              <div className="text-xs space-y-1 min-w-[140px]">
                <div
                  className="font-bold text-sm"
                  style={{ color: THEME_COLORS[popup.theme] ?? "#374151" }}
                >
                  {THEME_LABELS[popup.theme] ?? popup.theme}
                </div>
                <div className="text-gray-600">{popup.ward_name}</div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Urgency:</span>
                  <span
                    className="font-semibold"
                    style={{
                      color:
                        popup.urgency >= 0.9
                          ? "#ef4444"
                          : popup.urgency >= 0.75
                          ? "#f59e0b"
                          : "#3b82f6",
                    }}
                  >
                    {popup.urgency >= 0.9
                      ? "Critical"
                      : popup.urgency >= 0.75
                      ? "High"
                      : "Medium"}{" "}
                    ({(popup.urgency * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            </Popup>
          )}
        </Map>

        {/* Ward hover overlay */}
        {hoveredWardData && (
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2.5 shadow text-xs space-y-1 pointer-events-none z-10">
            <div className="font-bold text-gray-900 text-sm">{hoveredWardData.name}</div>
            <div className="flex gap-3 text-gray-600">
              <span>
                <span className="font-semibold text-primary-700">
                  {hoveredWardData.submission_count}
                </span>{" "}
                submissions
              </span>
              <span>
                Pop{" "}
                <span className="font-semibold text-gray-800">
                  {hoveredWardData.population.toLocaleString()}
                </span>
              </span>
            </div>
            <div className="text-gray-500">
              Top issue:{" "}
              <span
                className="font-semibold"
                style={{ color: THEME_COLORS[hoveredWardData.top_theme as ThemeKey] }}
              >
                {THEME_LABELS[hoveredWardData.top_theme as ThemeKey]}
              </span>
            </div>
          </div>
        )}

        {/* Scale legend */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 text-xs shadow pointer-events-none">
          <div className="font-semibold text-gray-700 mb-1.5">Submission Density</div>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded overflow-hidden">
              {["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"].map((c) => (
                <div key={c} className="w-5 h-3" style={{ background: c }} />
              ))}
            </div>
            <span className="text-gray-500 text-[10px]">Low → High</span>
          </div>
        </div>
      </div>

      {/* Bottom legend — theme dot key */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs">
        <span className="font-semibold text-gray-600 text-[11px]">Themes:</span>
        {(Object.keys(THEME_COLORS) as ThemeKey[]).map((k) => (
          <span key={k} className="flex items-center gap-1 text-gray-500">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: THEME_COLORS[k] }}
            />
            {THEME_LABELS[k].split(" ")[0]}
          </span>
        ))}
        <span className="ml-auto text-gray-400 italic text-[10px]">
          Hover ward for details · Click dot for submission
        </span>
      </div>
    </div>
  );
}
