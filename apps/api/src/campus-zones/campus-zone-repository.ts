import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

export const campusZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  boundary: polygonSchema,
});

export type CampusZoneDto = z.infer<typeof campusZoneSchema>;

interface CampusZoneRow {
  id: string;
  name: string;
  isActive: boolean;
  boundary: string;
}

function toDto(row: CampusZoneRow): CampusZoneDto {
  return campusZoneSchema.parse({ ...row, boundary: JSON.parse(row.boundary) });
}

export class CampusZoneRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActive(): Promise<CampusZoneDto | null> {
    const rows = await this.prisma.$queryRaw<CampusZoneRow[]>`
      SELECT id, name, "isActive", ST_AsGeoJSON(boundary) AS boundary
      FROM "CampusZone"
      WHERE "isActive" = true
      ORDER BY id
      LIMIT 1`;
    return rows[0] ? toDto(rows[0]) : null;
  }

  async listAll(): Promise<CampusZoneDto[]> {
    const rows = await this.prisma.$queryRaw<CampusZoneRow[]>`
      SELECT id, name, "isActive", ST_AsGeoJSON(boundary) AS boundary
      FROM "CampusZone"
      ORDER BY name`;
    return rows.map(toDto);
  }
}
