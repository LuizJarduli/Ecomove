import type { Polygon } from "geojson";

/** Default FACENS CampusZone GeoJSON preview used on the public landing showcase. */
export const FACENS_PREVIEW_ZONE: {
  id: string;
  name: string;
  isActive: boolean;
  boundary: Polygon;
} = {
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
