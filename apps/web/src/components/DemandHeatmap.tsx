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
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center h-72 gap-3 text-center px-6">
        <span className="text-3xl">🗺️</span>
        <p className="text-sm font-semibold text-gray-700">Mapbox token not configured</p>
        <p className="text-xs text-gray-500 max-w-xs">
          Add <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...</code> to{" "}
          <code className="bg-gray-100 px-1 rounded">apps/web/.env.local</code> to enable the demand heatmap.
        </p>
        <a
          href="https://account.mapbox.com/access-tokens/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          Get a free Mapbox token →
        </a>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 h-72">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <Spinner size="lg" />
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
