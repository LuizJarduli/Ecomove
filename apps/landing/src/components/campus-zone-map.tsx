"use client";

import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression } from "leaflet";
import { geoJSON } from "leaflet";
import { useMemo } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { CampusZonePreview } from "@/lib/facens-preview-zone";

export default function CampusZoneMap({
  zone,
  heightClass = "h-[480px]",
}: {
  zone: CampusZonePreview;
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
    </MapContainer>
  );
}
