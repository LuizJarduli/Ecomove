"use client";

import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression } from "leaflet";
import { geoJSON } from "leaflet";
import { useMemo } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { CampusZone } from "@/lib/api";

export default function CampusZoneMap({ zone }: { zone: CampusZone }) {
  const bounds = useMemo(() => geoJSON(zone.boundary).getBounds() as LatLngBoundsExpression, [zone.boundary]);

  return (
    <MapContainer bounds={bounds} className="h-[480px] w-full rounded-lg" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON key={zone.id} data={zone.boundary} style={{ color: "#16a34a", weight: 3, fillOpacity: 0.15 }} />
    </MapContainer>
  );
}
