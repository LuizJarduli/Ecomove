import type { Polygon } from "geojson";

export interface CampusZonePreview {
  id: string;
  name: string;
  isActive: boolean;
  boundary: Polygon;
}

/** Default FACENS CampusZone GeoJSON preview used on the standalone public landing showcase. */
export const FACENS_PREVIEW_ZONE: CampusZonePreview = {
  id: "facens-campus-preview",
  name: "Campus Universitário FACENS — Sorocaba/SP",
  isActive: true,
  boundary: {
    type: "Polygon",
    coordinates: [
      [
        [-47.454, -23.493],
        [-47.444, -23.493],
        [-47.444, -23.486],
        [-47.454, -23.486],
        [-47.454, -23.493],
      ],
    ],
  },
};
