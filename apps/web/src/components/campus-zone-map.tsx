"use client";

import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression } from "leaflet";
import { geoJSON } from "leaflet";
import { useMemo } from "react";
import { CircleMarker, GeoJSON, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import type { CampusZone, SpatialHeatmap } from "@/lib/api";

export default function CampusZoneMap({
  zone,
  heatmap,
  heightClass = "h-[480px]",
}: {
  zone: CampusZone;
  heatmap?: SpatialHeatmap;
  heightClass?: string;
}) {
  const bounds = useMemo(
    () => geoJSON(zone.boundary).getBounds() as LatLngBoundsExpression,
    [zone.boundary],
  );

  return (
    <MapContainer
      bounds={bounds}
      data-lenis-prevent
      className={`${heightClass} w-full rounded-2xl border border-[#E7E7E4]`}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        key={zone.id}
        data={zone.boundary}
        style={{ color: "#10b981", weight: 2.5, fillColor: "#10b981", fillOpacity: 0.14 }}
      />
      {heatmap?.tripCorridors.map((corridor) => {
        const positions = corridor.route.coordinates.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );
        return (
          <Polyline
            key={corridor.id}
            positions={positions}
            pathOptions={{
              color: corridor.transportMode === "BICYCLE" ? "#059669" : "#2563eb",
              weight: 4,
              opacity: 0.78,
            }}
          />
        );
      })}
      {heatmap?.hazardClusters.map((cluster) => {
        const [lng, lat] = cluster.coordinates;
        return (
          <CircleMarker
            key={cluster.id}
            center={[lat, lng]}
            radius={8 + Math.min(10, cluster.endorsementCount * 2)}
            pathOptions={{
              color: cluster.status === "APPROVED" ? "#dc2626" : "#d97706",
              fillColor: cluster.status === "APPROVED" ? "#ef4444" : "#f59e0b",
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div className="space-y-1 text-xs">
                <p className="font-semibold">{cluster.description}</p>
                <p className="text-[#6B6B6B]">
                  Categoria: {cluster.category} · {cluster.endorsementCount} confirmações (30m)
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
