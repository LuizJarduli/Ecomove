import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hazardCategorySchema, hazardStatusSchema } from "../hazards/hazard-repository.js";
import { lineStringSchema, transportModeSchema } from "../trips/trip-repository.js";

export const modalSplitItemSchema = z.object({
  transportMode: transportModeSchema,
  tripCount: z.number().int(),
  distanceKm: z.number(),
  co2SavedGrams: z.number(),
});

export const hourlyBucketSchema = z.object({
  hour: z.number().int().min(0).max(23),
  tripCount: z.number().int(),
});

export const hazardSummaryItemSchema = z.object({
  category: hazardCategorySchema,
  status: hazardStatusSchema,
  count: z.number().int(),
  totalEndorsements: z.number().int(),
});

export const analyticsOverviewDtoSchema = z.object({
  totalCommuters: z.number().int(),
  institutionalCommuters: z.number().int(),
  externalCommuters: z.number().int(),
  totalValidatedTrips: z.number().int(),
  totalDistanceKm: z.number(),
  totalCo2SavedGrams: z.number(),
  modalSplit: z.array(modalSplitItemSchema),
  hourlyDistribution: z.array(hourlyBucketSchema),
  hazardSummary: z.array(hazardSummaryItemSchema),
});
export type AnalyticsOverviewDto = z.infer<typeof analyticsOverviewDtoSchema>;

export const spatialHeatmapDtoSchema = z.object({
  tripCorridors: z.array(
    z.object({
      id: z.string(),
      transportMode: transportModeSchema,
      distanceMeters: z.number(),
      co2SavedGrams: z.number(),
      route: lineStringSchema,
    }),
  ),
  hazardClusters: z.array(
    z.object({
      id: z.string(),
      category: hazardCategorySchema,
      status: hazardStatusSchema,
      description: z.string(),
      endorsementCount: z.number().int(),
      weight: z.number(),
      coordinates: z.tuple([z.number(), z.number()]),
    }),
  ),
});
export type SpatialHeatmapDto = z.infer<typeof spatialHeatmapDtoSchema>;

export interface AnalyticsFilter {
  from?: Date;
  to?: Date;
  institutionalOnly?: boolean;
}

export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOverview(filter: AnalyticsFilter = {}): Promise<AnalyticsOverviewDto> {
    const institutionalOnly = filter.institutionalOnly ?? false;
    const fromDate = filter.from ?? new Date("2000-01-01T00:00:00.000Z");
    const toDate = filter.to ?? new Date("2100-01-01T00:00:00.000Z");

    const [commuterCounts] = await this.prisma.$queryRaw<
      Array<{ total: number; institutional: number; external: number }>
    >`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "isInstitutional" = true)::int AS institutional,
        COUNT(*) FILTER (WHERE "isInstitutional" = false)::int AS external
      FROM "Commuter"
      WHERE (${institutionalOnly} = false OR "isInstitutional" = true)
    `;

    const modalRows = await this.prisma.$queryRaw<
      Array<{
        transportMode: "WALK" | "BICYCLE" | "PUBLIC_TRANSIT" | "CARPOOL";
        tripCount: number;
        distanceKm: number;
        co2SavedGrams: number;
      }>
    >`
      SELECT
        t."transportMode",
        COUNT(*)::int AS "tripCount",
        COALESCE(SUM(t."distanceMeters") / 1000.0, 0)::float8 AS "distanceKm",
        COALESCE(SUM(t."co2SavedGrams"), 0)::float8 AS "co2SavedGrams"
      FROM "Trip" t
      JOIN "Commuter" c ON c.id = t."commuterId"
      WHERE t.status = 'VALIDATED'::"TripStatus"
        AND t."startedAt" >= ${fromDate}
        AND t."startedAt" <= ${toDate}
        AND (${institutionalOnly} = false OR c."isInstitutional" = true)
      GROUP BY t."transportMode"
      ORDER BY "tripCount" DESC
    `;

    const hourlyRows = await this.prisma.$queryRaw<Array<{ hour: number; tripCount: number }>>`
      SELECT
        EXTRACT(HOUR FROM (t."startedAt" AT TIME ZONE 'America/Sao_Paulo'))::int AS hour,
        COUNT(*)::int AS "tripCount"
      FROM "Trip" t
      JOIN "Commuter" c ON c.id = t."commuterId"
      WHERE t.status = 'VALIDATED'::"TripStatus"
        AND t."startedAt" >= ${fromDate}
        AND t."startedAt" <= ${toDate}
        AND (${institutionalOnly} = false OR c."isInstitutional" = true)
      GROUP BY hour
      ORDER BY hour ASC
    `;

    const hourMap = new Map(hourlyRows.map((r) => [r.hour, r.tripCount]));
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      tripCount: hourMap.get(hour) ?? 0,
    }));

    const hazardRows = await this.prisma.$queryRaw<
      Array<{
        category: "SIDEWALK_DAMAGE" | "BIKE_LANE_OBSTRUCTION" | "POOR_LIGHTING" | "BUS_STOP_ISSUE" | "OTHER";
        status: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
        count: number;
        totalEndorsements: number;
      }>
    >`
      SELECT
        h.category,
        h.status,
        COUNT(*)::int AS count,
        COALESCE(SUM(h."endorsementCount"), 0)::int AS "totalEndorsements"
      FROM "HazardReport" h
      JOIN "Commuter" c ON c.id = h."reporterId"
      WHERE h.status IN ('PENDING'::"HazardStatus", 'APPROVED'::"HazardStatus", 'RESOLVED'::"HazardStatus")
        AND (${institutionalOnly} = false OR c."isInstitutional" = true)
      GROUP BY h.category, h.status
      ORDER BY "totalEndorsements" DESC
    `;

    const totalValidatedTrips = modalRows.reduce((acc, r) => acc + r.tripCount, 0);
    const totalDistanceKm =
      Math.round(modalRows.reduce((acc, r) => acc + r.distanceKm, 0) * 100) / 100;
    const totalCo2SavedGrams =
      Math.round(modalRows.reduce((acc, r) => acc + r.co2SavedGrams, 0) * 100) / 100;

    return analyticsOverviewDtoSchema.parse({
      totalCommuters: commuterCounts?.total ?? 0,
      institutionalCommuters: commuterCounts?.institutional ?? 0,
      externalCommuters: commuterCounts?.external ?? 0,
      totalValidatedTrips,
      totalDistanceKm,
      totalCo2SavedGrams,
      modalSplit: modalRows.map((r) => ({
        transportMode: r.transportMode,
        tripCount: r.tripCount,
        distanceKm: Math.round(r.distanceKm * 100) / 100,
        co2SavedGrams: Math.round(r.co2SavedGrams * 100) / 100,
      })),
      hourlyDistribution,
      hazardSummary: hazardRows,
    });
  }

  async getSpatialHeatmap(filter: { institutionalOnly?: boolean } = {}): Promise<SpatialHeatmapDto> {
    const institutionalOnly = filter.institutionalOnly ?? false;

    const corridorRows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        transportMode: "WALK" | "BICYCLE" | "PUBLIC_TRANSIT" | "CARPOOL";
        distanceMeters: number;
        co2SavedGrams: number;
        route: string;
      }>
    >`
      SELECT
        t.id,
        t."transportMode",
        t."distanceMeters",
        t."co2SavedGrams",
        ST_AsGeoJSON(t.route) AS route
      FROM "Trip" t
      JOIN "Commuter" c ON c.id = t."commuterId"
      WHERE t.status = 'VALIDATED'::"TripStatus"
        AND (${institutionalOnly} = false OR c."isInstitutional" = true)
      ORDER BY t."createdAt" DESC
      LIMIT 100
    `;

    const clusterRows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        category: "SIDEWALK_DAMAGE" | "BIKE_LANE_OBSTRUCTION" | "POOR_LIGHTING" | "BUS_STOP_ISSUE" | "OTHER";
        status: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
        description: string;
        endorsementCount: number;
        location: string;
      }>
    >`
      SELECT
        h.id,
        h.category,
        h.status,
        h.description,
        h."endorsementCount",
        ST_AsGeoJSON(h.location) AS location
      FROM "HazardReport" h
      JOIN "Commuter" c ON c.id = h."reporterId"
      WHERE h.status IN ('PENDING'::"HazardStatus", 'APPROVED'::"HazardStatus")
        AND (${institutionalOnly} = false OR c."isInstitutional" = true)
      ORDER BY h."endorsementCount" DESC, h."createdAt" DESC
      LIMIT 100
    `;

    return spatialHeatmapDtoSchema.parse({
      tripCorridors: corridorRows.map((row) => ({
        id: row.id,
        transportMode: row.transportMode,
        distanceMeters: Math.round(row.distanceMeters * 100) / 100,
        co2SavedGrams: Math.round(row.co2SavedGrams * 100) / 100,
        route: JSON.parse(row.route),
      })),
      hazardClusters: clusterRows.map((row) => {
        const parsed = JSON.parse(row.location) as { coordinates: [number, number] };
        return {
          id: row.id,
          category: row.category,
          status: row.status,
          description: row.description,
          endorsementCount: row.endorsementCount,
          weight: Math.min(1, 0.25 + row.endorsementCount * 0.15),
          coordinates: parsed.coordinates,
        };
      }),
    });
  }
}
