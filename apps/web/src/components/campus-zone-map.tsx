"use client";

import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression } from "leaflet";
import { geoJSON } from "leaflet";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { CampusZone } from "@/lib/api";

export default function CampusZoneMap({ zone }: { zone: CampusZone }) {
  const bounds = geoJSON(zone.boundary).getBounds() as LatLngBoundsExpression;

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
