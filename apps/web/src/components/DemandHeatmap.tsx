"use client";

import { useEffect, useRef, useState } from "react";
import { fetchHotspots } from "@/lib/api-mock";
import { Spinner } from "@/components/ui";

// Mapbox token must be set in .env.local as NEXT_PUBLIC_MAPBOX_TOKEN
// Without it, the map shows a placeholder with instructions.
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function DemandHeatmap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [noToken, setNoToken] = useState(false);

  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setNoToken(true);
      return;
    }

    let map: any;

    (async () => {
      const [mapboxgl, geoData] = await Promise.all([
        import("mapbox-gl").then((m) => m.default),
        fetchHotspots(),
      ]);

      (mapboxgl as any).accessToken = MAPBOX_TOKEN;

      map = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/light-v11",
        center: [77.209, 28.614],
        zoom: 11,
      });

      map.on("load", () => {
        map.addSource("hotspots", { type: "geojson", data: geoData });

        // Heatmap layer
        map.addLayer({
          id: "submissions-heat",
          type: "heatmap",
          source: "hotspots",
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "urgency_score"], 0, 0, 1, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 11, 1, 15, 3],
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(59,130,246,0)",
              0.2, "rgba(59,130,246,0.4)",
              0.5, "rgba(251,191,36,0.7)",
              0.8, "rgba(239,68,68,0.85)",
              1, "rgba(185,28,28,1)",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 11, 30, 15, 60],
          },
        });

        // Circle layer (zoomed in)
        map.addLayer({
          id: "submissions-point",
          type: "circle",
          source: "hotspots",
          minzoom: 13,
          paint: {
            "circle-radius": 6,
            "circle-color": "#3b82f6",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.85,
          },
        });

        setLoaded(true);
      });
    })();

    return () => { map?.remove(); };
  }, []);

  if (noToken) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-white flex flex-col items-center justify-center h-80 gap-4 text-center px-6 shadow-soft">
        <div className="w-16 h-16 bg-gradient-to-r from-rose-500 to-amber-500 rounded-2xl flex items-center justify-center text-white text-3xl shadow-soft">
          🗺️
        </div>
        <div className="space-y-2">
          <p className="text-base font-bold text-gray-900">Mapbox Token Required</p>
          <p className="text-xs text-gray-600 max-w-sm leading-relaxed">
            Add <code className="bg-gray-200 px-2 py-0.5 rounded font-mono text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
            <code className="bg-gray-200 px-2 py-0.5 rounded font-mono text-xs">apps/web/.env.local</code> to enable the interactive demand heatmap.
          </p>
        </div>
        <a
          href="https://account.mapbox.com/access-tokens/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-semibold rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-soft hover:shadow-glow-blue transform hover:scale-105 flex items-center gap-2"
        >
          Get Free Mapbox Token
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 h-80 shadow-soft-lg">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-purple-50 z-10 gap-3">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-gray-600">Loading heatmap...</p>
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Map Legend */}
      {loaded && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm border-2 border-gray-200 rounded-xl p-3 shadow-soft text-xs">
          <p className="font-bold text-gray-900 mb-2">Demand Intensity</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded" style={{ background: 'rgba(59,130,246,0.4)' }}></div>
              <div className="w-4 h-4 rounded" style={{ background: 'rgba(251,191,36,0.7)' }}></div>
              <div className="w-4 h-4 rounded" style={{ background: 'rgba(239,68,68,0.85)' }}></div>
            </div>
            <span className="text-gray-600">Low → High</span>
          </div>
        </div>
      )}
    </div>
  );
}
