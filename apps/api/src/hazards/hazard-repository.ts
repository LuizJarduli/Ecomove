import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { MediaStorageService } from "./media-storage.js";

export const hazardCategorySchema = z.enum([
  "SIDEWALK_DAMAGE",
  "BIKE_LANE_OBSTRUCTION",
  "POOR_LIGHTING",
  "BUS_STOP_ISSUE",
  "OTHER",
]);
export type HazardCategoryDto = z.infer<typeof hazardCategorySchema>;

export const hazardStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "RESOLVED"]);
export type HazardStatusDto = z.infer<typeof hazardStatusSchema>;

export const pointGeometrySchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const hazardReportDtoSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  category: hazardCategorySchema,
  status: hazardStatusSchema,
  description: z.string(),
  photoUrl: z.string(),
  location: pointGeometrySchema,
  endorsementCount: z.number().int(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type HazardReportDto = z.infer<typeof hazardReportDtoSchema>;

export const createHazardInputSchema = z.object({
  category: hazardCategorySchema,
  description: z.string().trim().min(4).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  photoDataBase64: z.string().optional(),
  photoUrl: z.string().optional(),
  forceCreate: z.boolean().optional(),
});
export type CreateHazardInput = z.infer<typeof createHazardInputSchema>;

export const DEDUPLICATION_RADIUS_METERS = 30;
export const HAZARD_APPROVAL_ECOPOINTS = 25;

export class DuplicateNearbyHazardError extends Error {
  constructor(readonly existingReport: HazardReportDto) {
    super("Problema já reportado próximo a você — Confirmar ocorrência (+1)?");
  }
}

export class HazardDomainError extends Error {
  constructor(
    readonly statusCode: 400 | 404 | 409,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface HazardRow {
  id: string;
  reporterId: string;
  category: HazardCategoryDto;
  status: HazardStatusDto;
  description: string;
  photoUrl: string;
  location: string;
  endorsementCount: number;
  resolvedAt: Date | null;
  createdAt: Date;
}

function toHazardDto(row: HazardRow): HazardReportDto {
  return hazardReportDtoSchema.parse({
    id: row.id,
    reporterId: row.reporterId,
    category: row.category,
    status: row.status,
    description: row.description,
    photoUrl: row.photoUrl,
    location: JSON.parse(row.location),
    endorsementCount: row.endorsementCount,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  });
}

export class HazardRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly mediaStorage: MediaStorageService,
  ) {}

  async listActive(): Promise<HazardReportDto[]> {
    const rows = await this.prisma.$queryRaw<HazardRow[]>`
      SELECT
        id,
        "reporterId",
        category,
        status,
        description,
        "photoUrl",
        ST_AsGeoJSON(location) AS location,
        "endorsementCount",
        "resolvedAt",
        "createdAt"
      FROM "HazardReport"
      WHERE status IN ('PENDING'::"HazardStatus", 'APPROVED'::"HazardStatus", 'RESOLVED'::"HazardStatus")
      ORDER BY "endorsementCount" DESC, "createdAt" DESC
    `;
    return rows.map(toHazardDto);
  }

  async findNearbyDuplicate(params: {
    latitude: number;
    longitude: number;
    category: HazardCategoryDto;
  }): Promise<HazardReportDto | null> {
    const rows = await this.prisma.$queryRaw<HazardRow[]>`
      SELECT
        id,
        "reporterId",
        category,
        status,
        description,
        "photoUrl",
        ST_AsGeoJSON(location) AS location,
        "endorsementCount",
        "resolvedAt",
        "createdAt"
      FROM "HazardReport"
      WHERE category = ${params.category}::"HazardCategory"
        AND status IN ('PENDING'::"HazardStatus", 'APPROVED'::"HazardStatus")
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint(${params.longitude}::float8, ${params.latitude}::float8), 4326)::geography,
          ${DEDUPLICATION_RADIUS_METERS}::float8
        )
      ORDER BY
        ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint(${params.longitude}::float8, ${params.latitude}::float8), 4326)::geography
        ) ASC
      LIMIT 1
    `;
    return rows[0] ? toHazardDto(rows[0]) : null;
  }

  async createHazard(reporterId: string, input: CreateHazardInput): Promise<HazardReportDto> {
    const photoUrl = await this.mediaStorage.storeHazardPhoto({
      base64Webp: input.photoDataBase64,
      photoUrl: input.photoUrl,
    });

    if (!input.forceCreate) {
      const nearby = await this.findNearbyDuplicate({
        latitude: input.latitude,
        longitude: input.longitude,
        category: input.category,
      });
      if (nearby) {
        throw new DuplicateNearbyHazardError(nearby);
      }
    }

    const inserted = await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<HazardRow[]>`
        INSERT INTO "HazardReport" (
          id,
          "reporterId",
          category,
          status,
          description,
          "photoUrl",
          location,
          "endorsementCount",
          "updatedAt"
        )
        VALUES (
          gen_random_uuid()::text,
          ${reporterId},
          ${input.category}::"HazardCategory",
          'PENDING'::"HazardStatus",
          ${input.description},
          ${photoUrl},
          ST_SetSRID(ST_MakePoint(${input.longitude}::float8, ${input.latitude}::float8), 4326),
          1,
          CURRENT_TIMESTAMP
        )
        RETURNING
          id,
          "reporterId",
          category,
          status,
          description,
          "photoUrl",
          ST_AsGeoJSON(location) AS location,
          "endorsementCount",
          "resolvedAt",
          "createdAt"
      `;

      if (row) {
        await tx.hazardEndorsement.create({
          data: {
            hazardReportId: row.id,
            commuterId: reporterId,
          },
        });
      }

      return row!;
    });

    return toHazardDto(inserted);
  }

  async endorseHazard(hazardReportId: string, commuterId: string): Promise<HazardReportDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.hazardReport.findUnique({ where: { id: hazardReportId } });
      if (!existing) {
        throw new HazardDomainError(404, "HAZARD_NOT_FOUND", "Ocorrência urbana não encontrada.");
      }

      const duplicateEndorsement = await tx.hazardEndorsement.findUnique({
        where: {
          hazardReportId_commuterId: {
            hazardReportId,
            commuterId,
          },
        },
      });
      if (duplicateEndorsement) {
        throw new HazardDomainError(
          409,
          "ALREADY_ENDORSED",
          "Você já confirmou esta ocorrência urbana.",
        );
      }

      await tx.hazardEndorsement.create({
        data: {
          hazardReportId,
          commuterId,
        },
      });

      const [row] = await tx.$queryRaw<HazardRow[]>`
        UPDATE "HazardReport"
        SET
          "endorsementCount" = "endorsementCount" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${hazardReportId}
        RETURNING
          id,
          "reporterId",
          category,
          status,
          description,
          "photoUrl",
          ST_AsGeoJSON(location) AS location,
          "endorsementCount",
          "resolvedAt",
          "createdAt"
      `;
      return row!;
    });

    return toHazardDto(updated);
  }

  async transitionStatus(
    hazardReportId: string,
    targetStatus: "APPROVED" | "REJECTED" | "RESOLVED",
  ): Promise<HazardReportDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.hazardReport.findUnique({ where: { id: hazardReportId } });
      if (!existing) {
        throw new HazardDomainError(404, "HAZARD_NOT_FOUND", "Ocorrência urbana não encontrada.");
      }

      const validFromPending =
        existing.status === "PENDING" &&
        (targetStatus === "APPROVED" || targetStatus === "REJECTED");
      const validFromApproved =
        existing.status === "APPROVED" && targetStatus === "RESOLVED";

      if (!validFromPending && !validFromApproved) {
        throw new HazardDomainError(
          400,
          "INVALID_STATUS_TRANSITION",
          `Transição de status inválida de ${existing.status} para ${targetStatus}.`,
        );
      }

      const [row] = await tx.$queryRaw<HazardRow[]>`
        UPDATE "HazardReport"
        SET
          status = ${targetStatus}::"HazardStatus",
          "resolvedAt" = CASE WHEN ${targetStatus} = 'RESOLVED' THEN CURRENT_TIMESTAMP ELSE "resolvedAt" END,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${hazardReportId}
        RETURNING
          id,
          "reporterId",
          category,
          status,
          description,
          "photoUrl",
          ST_AsGeoJSON(location) AS location,
          "endorsementCount",
          "resolvedAt",
          "createdAt"
      `;

      if (existing.status === "PENDING" && targetStatus === "APPROVED" && row) {
        await tx.pointTransaction.create({
          data: {
            commuterId: existing.reporterId,
            amount: HAZARD_APPROVAL_ECOPOINTS,
            reason: "HAZARD_APPROVED",
            hazardReportId: row.id,
          },
        });
        await tx.commuter.update({
          where: { id: existing.reporterId },
          data: {
            ecoPointsBalance: { increment: HAZARD_APPROVAL_ECOPOINTS },
          },
        });
      }

      return row!;
    });

    return toHazardDto(updated);
  }
}
