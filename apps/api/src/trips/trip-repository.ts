import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

export const transportModeSchema = z.enum(["WALK", "BICYCLE", "PUBLIC_TRANSIT", "CARPOOL"]);
export type TransportModeDto = z.infer<typeof transportModeSchema>;

export const tripStatusSchema = z.enum(["RECORDING", "VALIDATED", "PENDING_REVIEW", "REJECTED"]);
export type TripStatusDto = z.infer<typeof tripStatusSchema>;

export const pointTransactionReasonSchema = z.enum([
  "TRIP_VALIDATED",
  "HAZARD_APPROVED",
  "REWARD_REDEEMED",
  "REDEMPTION_EXPIRED_REFUND",
]);
export type PointTransactionReasonDto = z.infer<typeof pointTransactionReasonSchema>;

export const lineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
});

export const tripDtoSchema = z.object({
  id: z.string(),
  commuterId: z.string(),
  transportMode: transportModeSchema,
  status: tripStatusSchema,
  route: lineStringSchema,
  distanceMeters: z.number(),
  durationSeconds: z.number().int(),
  avgSpeedKmh: z.number(),
  peakSpeedKmh: z.number(),
  co2SavedGrams: z.number(),
  ecoPointsEarned: z.number().int(),
  rejectionReason: z.string().nullable(),
  carpoolSessionId: z.string().nullable().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
  createdAt: z.string(),
});
export type TripDto = z.infer<typeof tripDtoSchema>;

export const pointTransactionDtoSchema = z.object({
  id: z.string(),
  commuterId: z.string(),
  amount: z.number().int(),
  reason: pointTransactionReasonSchema,
  tripId: z.string().nullable(),
  hazardReportId: z.string().nullable().optional(),
  redemptionId: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type PointTransactionDto = z.infer<typeof pointTransactionDtoSchema>;

export const gpsCoordinateInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  recordedAt: z.string().datetime(),
});
export type GpsCoordinateInput = z.infer<typeof gpsCoordinateInputSchema>;

export const createTripInputSchema = z.object({
  transportMode: transportModeSchema,
  coordinates: z.array(gpsCoordinateInputSchema).min(2),
  carpoolSessionId: z.string().min(1).optional(),
});
export type CreateTripInput = z.infer<typeof createTripInputSchema>;

export const MIN_TRIP_DISTANCE_METERS = 300;
export const DAILY_TRIP_ECOPOINTS_CAP = 100;

export const MODE_RULES: Record<
  TransportModeDto,
  {
    maxCleanAvgSpeedKmh: number;
    maxCleanPeakSpeedKmh: number;
    hardRejectAvgSpeedKmh: number;
    hardRejectPeakSpeedKmh: number;
    pointsPerKm: number;
    co2GramsPerKm: number;
  }
> = {
  WALK: {
    maxCleanAvgSpeedKmh: 8,
    maxCleanPeakSpeedKmh: 12,
    hardRejectAvgSpeedKmh: 12,
    hardRejectPeakSpeedKmh: 18,
    pointsPerKm: 10,
    co2GramsPerKm: 140,
  },
  BICYCLE: {
    maxCleanAvgSpeedKmh: 28,
    maxCleanPeakSpeedKmh: 38,
    hardRejectAvgSpeedKmh: 35,
    hardRejectPeakSpeedKmh: 50,
    pointsPerKm: 8,
    co2GramsPerKm: 140,
  },
  CARPOOL: {
    maxCleanAvgSpeedKmh: 60,
    maxCleanPeakSpeedKmh: 90,
    hardRejectAvgSpeedKmh: 80,
    hardRejectPeakSpeedKmh: 120,
    pointsPerKm: 5,
    co2GramsPerKm: 70,
  },
  PUBLIC_TRANSIT: {
    maxCleanAvgSpeedKmh: 55,
    maxCleanPeakSpeedKmh: 85,
    hardRejectAvgSpeedKmh: 75,
    hardRejectPeakSpeedKmh: 110,
    pointsPerKm: 4,
    co2GramsPerKm: 100,
  },
};

export class InvalidTripTrajectoryError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class TripStateTransitionError extends Error {
  constructor(
    readonly statusCode: 400 | 404,
    message: string,
  ) {
    super(message);
  }
}

interface SpatialEvaluationRow {
  distanceMeters: number;
  intersectsCampus: boolean;
  segmentDistancesMeters: number[];
}

interface TripRow {
  id: string;
  commuterId: string;
  transportMode: TransportModeDto;
  status: TripStatusDto;
  route: string;
  distanceMeters: number;
  durationSeconds: number;
  avgSpeedKmh: number;
  peakSpeedKmh: number;
  co2SavedGrams: number;
  ecoPointsEarned: number;
  rejectionReason: string | null;
  carpoolSessionId: string | null;
  startedAt: Date;
  endedAt: Date;
  createdAt: Date;
}

function toTripDto(row: TripRow): TripDto {
  return tripDtoSchema.parse({
    ...row,
    route: JSON.parse(row.route),
    distanceMeters: Math.round(row.distanceMeters * 100) / 100,
    avgSpeedKmh: Math.round(row.avgSpeedKmh * 100) / 100,
    peakSpeedKmh: Math.round(row.peakSpeedKmh * 100) / 100,
    co2SavedGrams: Math.round(row.co2SavedGrams * 100) / 100,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  });
}

async function computeCappedTripPoints(
  tx: Prisma.TransactionClient,
  commuterId: string,
  rawPoints: number,
): Promise<number> {
  if (rawPoints <= 0) return 0;
  await tx.$queryRaw`SELECT id FROM "Commuter" WHERE id = ${commuterId} FOR UPDATE`;
  const [dailyRow] = await tx.$queryRaw<Array<{ earnedToday: number }>>`
    SELECT COALESCE(SUM(amount), 0)::int AS "earnedToday"
    FROM "PointTransaction"
    WHERE "commuterId" = ${commuterId}
      AND reason = 'TRIP_VALIDATED'::"PointTransactionReason"
      AND ("createdAt" AT TIME ZONE 'America/Sao_Paulo')::date =
          (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
  `;
  const earnedToday = dailyRow?.earnedToday ?? 0;
  const remainingCap = Math.max(0, DAILY_TRIP_ECOPOINTS_CAP - earnedToday);
  return Math.min(rawPoints, remainingCap);
}

export class TripRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordTrip(commuterId: string, input: CreateTripInput): Promise<TripDto> {
    const coords = input.coordinates;
    const timestampsMs = coords.map((point) => new Date(point.recordedAt).getTime());

    for (let i = 1; i < timestampsMs.length; i++) {
      if (timestampsMs[i]! <= timestampsMs[i - 1]!) {
        throw new InvalidTripTrajectoryError(
          "As coordenadas GPS devem possuir carimbos de tempo estritamente crescentes.",
        );
      }
    }

    const startedAt = new Date(timestampsMs[0]!);
    const endedAt = new Date(timestampsMs[timestampsMs.length - 1]!);
    const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

    const lons = coords.map((point) => point.longitude);
    const lats = coords.map((point) => point.latitude);

    const [spatial] = await this.prisma.$queryRaw<SpatialEvaluationRow[]>`
      WITH pts AS (
        SELECT
          ord,
          ST_SetSRID(ST_MakePoint(lon, lat), 4326) AS pt,
          LAG(ST_SetSRID(ST_MakePoint(lon, lat), 4326)) OVER (ORDER BY ord) AS prev_pt
        FROM unnest(${lons}::float8[], ${lats}::float8[]) WITH ORDINALITY AS t(lon, lat, ord)
      ),
      line AS (
        SELECT ST_MakeLine(pt ORDER BY ord) AS geom FROM pts
      ),
      seg_distances AS (
        SELECT
          COALESCE(
            array_agg(ST_Distance(pt::geography, prev_pt::geography) ORDER BY ord)
              FILTER (WHERE prev_pt IS NOT NULL),
            ARRAY[]::float8[]
          ) AS distances
        FROM pts
      )
      SELECT
        ST_Length(line.geom::geography)::float8 AS "distanceMeters",
        EXISTS (
          SELECT 1 FROM "CampusZone" cz
          WHERE cz."isActive" = true AND ST_Intersects(line.geom, cz.boundary)
        ) AS "intersectsCampus",
        seg_distances.distances AS "segmentDistancesMeters"
      FROM line, seg_distances
    `;

    const distanceMeters = spatial?.distanceMeters ?? 0;
    const intersectsCampus = spatial?.intersectsCampus ?? false;
    const segmentDistancesMeters = spatial?.segmentDistancesMeters ?? [];

    const avgSpeedKmh = (distanceMeters * 3.6) / durationSeconds;
    let peakSpeedKmh = avgSpeedKmh;

    for (let i = 0; i < segmentDistancesMeters.length; i++) {
      const segDist = segmentDistancesMeters[i] ?? 0;
      const segDeltaSec = (timestampsMs[i + 1]! - timestampsMs[i]!) / 1000;
      if (segDeltaSec > 0) {
        const segSpeedKmh = (segDist * 3.6) / segDeltaSec;
        if (segSpeedKmh > peakSpeedKmh) {
          peakSpeedKmh = segSpeedKmh;
        }
      }
    }

    const rule = MODE_RULES[input.transportMode];
    let status: TripStatusDto;
    let rejectionReason: string | null = null;
    let linkedCarpoolSessionId: string | null = input.carpoolSessionId ?? null;

    if (input.transportMode === "CARPOOL") {
      if (!linkedCarpoolSessionId) {
        status = "REJECTED";
        rejectionReason =
          "CARPOOL_SESSION_REQUIRED: Sessão de carona (QR / Código) obrigatória para Carona Solidária.";
      } else {
        const session = await this.prisma.carpoolSession.findUnique({
          where: { id: linkedCarpoolSessionId },
          include: { participants: true },
        });
        const isParticipant = session?.participants.some((p) => p.commuterId === commuterId) ?? false;
        if (!session || !isParticipant) {
          status = "REJECTED";
          rejectionReason =
            "CARPOOL_SESSION_INVALID: Usuário não vinculado a esta sessão de carona.";
          linkedCarpoolSessionId = null;
        } else if (session.participants.length < 2) {
          status = "REJECTED";
          rejectionReason =
            "CARPOOL_MIN_PARTICIPANTS: Carona Solidária exige no mínimo 2 participantes pareados.";
        } else if (!intersectsCampus) {
          status = "REJECTED";
          rejectionReason =
            "OUTSIDE_CAMPUS_ZONE: O trajeto não intersecta a CampusZone ativa da FACENS.";
        } else if (distanceMeters < MIN_TRIP_DISTANCE_METERS) {
          status = "REJECTED";
          rejectionReason = "MIN_DISTANCE_NOT_MET: Distância mínima de 300 metros não atingida.";
        } else if (
          avgSpeedKmh > rule.hardRejectAvgSpeedKmh ||
          peakSpeedKmh > rule.hardRejectPeakSpeedKmh
        ) {
          status = "REJECTED";
          rejectionReason = "SPEED_LIMIT_EXCEEDED: Velocidade incompatível com o modal declarado.";
        } else {
          // Will be upgraded to VALIDATED inside transaction if peer already arrived
          status = "PENDING_REVIEW";
        }
      }
    } else if (!intersectsCampus) {
      status = "REJECTED";
      rejectionReason = "OUTSIDE_CAMPUS_ZONE: O trajeto não intersecta a CampusZone ativa da FACENS.";
    } else if (distanceMeters < MIN_TRIP_DISTANCE_METERS) {
      status = "REJECTED";
      rejectionReason = "MIN_DISTANCE_NOT_MET: Distância mínima de 300 metros não atingida.";
    } else if (avgSpeedKmh > rule.hardRejectAvgSpeedKmh || peakSpeedKmh > rule.hardRejectPeakSpeedKmh) {
      status = "REJECTED";
      rejectionReason = "SPEED_LIMIT_EXCEEDED: Velocidade incompatível com o modal declarado.";
    } else if (avgSpeedKmh > rule.maxCleanAvgSpeedKmh || peakSpeedKmh > rule.maxCleanPeakSpeedKmh) {
      status = "PENDING_REVIEW";
    } else {
      status = "VALIDATED";
    }

    const insertedRow = await this.prisma.$transaction(async (tx) => {
      // Check if peer Carpool participant already arrived in CampusZone
      let peerTripsToValidate: Array<{ id: string; commuterId: string; distanceMeters: number }> = [];
      if (
        input.transportMode === "CARPOOL" &&
        status === "PENDING_REVIEW" &&
        linkedCarpoolSessionId &&
        avgSpeedKmh <= rule.maxCleanAvgSpeedKmh &&
        peakSpeedKmh <= rule.maxCleanPeakSpeedKmh
      ) {
        const existingSessionTrips = await tx.trip.findMany({
          where: {
            carpoolSessionId: linkedCarpoolSessionId,
            commuterId: { not: commuterId },
            status: { in: ["PENDING_REVIEW", "VALIDATED"] },
          },
          select: { id: true, commuterId: true, distanceMeters: true, status: true },
        });
        if (existingSessionTrips.length >= 1) {
          status = "VALIDATED";
          peerTripsToValidate = existingSessionTrips
            .filter((t) => t.status === "PENDING_REVIEW")
            .map((t) => ({ id: t.id, commuterId: t.commuterId, distanceMeters: t.distanceMeters }));
        }
      }

      const co2SavedGrams =
        status === "VALIDATED" ? Math.round((distanceMeters / 1000) * rule.co2GramsPerKm * 100) / 100 : 0;
      const rawPoints = status === "VALIDATED" ? Math.round((distanceMeters / 1000) * rule.pointsPerKm) : 0;
      const ecoPointsEarned =
        status === "VALIDATED" ? await computeCappedTripPoints(tx, commuterId, rawPoints) : 0;

      const [tripRow] = await tx.$queryRaw<TripRow[]>`
        WITH pts AS (
          SELECT ord, ST_SetSRID(ST_MakePoint(lon, lat), 4326) AS pt
          FROM unnest(${lons}::float8[], ${lats}::float8[]) WITH ORDINALITY AS t(lon, lat, ord)
        ),
        line AS (
          SELECT ST_MakeLine(pt ORDER BY ord) AS geom FROM pts
        )
        INSERT INTO "Trip" (
          id,
          "commuterId",
          "transportMode",
          status,
          route,
          "distanceMeters",
          "durationSeconds",
          "avgSpeedKmh",
          "peakSpeedKmh",
          "co2SavedGrams",
          "ecoPointsEarned",
          "rejectionReason",
          "carpoolSessionId",
          "startedAt",
          "endedAt"
        )
        SELECT
          gen_random_uuid()::text,
          ${commuterId},
          ${input.transportMode}::"TransportMode",
          ${status}::"TripStatus",
          line.geom,
          ${distanceMeters}::float8,
          ${durationSeconds}::int,
          ${avgSpeedKmh}::float8,
          ${peakSpeedKmh}::float8,
          ${co2SavedGrams}::float8,
          ${ecoPointsEarned}::int,
          ${rejectionReason},
          ${linkedCarpoolSessionId},
          ${startedAt},
          ${endedAt}
        FROM line
        RETURNING
          id,
          "commuterId",
          "transportMode",
          status,
          ST_AsGeoJSON(route) AS route,
          "distanceMeters",
          "durationSeconds",
          "avgSpeedKmh",
          "peakSpeedKmh",
          "co2SavedGrams",
          "ecoPointsEarned",
          "rejectionReason",
          "carpoolSessionId",
          "startedAt",
          "endedAt",
          "createdAt"
      `;

      if (status === "VALIDATED" && ecoPointsEarned > 0 && tripRow) {
        await tx.pointTransaction.create({
          data: {
            commuterId,
            amount: ecoPointsEarned,
            reason: "TRIP_VALIDATED",
            tripId: tripRow.id,
          },
        });
        await tx.commuter.update({
          where: { id: commuterId },
          data: { ecoPointsBalance: { increment: ecoPointsEarned } },
        });
      }

      // Upgrade any waiting peer Carpool trips to VALIDATED now that mutual arrival is confirmed
      if (peerTripsToValidate.length > 0 && linkedCarpoolSessionId) {
        for (const peerTrip of peerTripsToValidate) {
          const peerCo2 =
            Math.round((peerTrip.distanceMeters / 1000) * rule.co2GramsPerKm * 100) / 100;
          const peerRawPts = Math.round((peerTrip.distanceMeters / 1000) * rule.pointsPerKm);
          const peerEarned = await computeCappedTripPoints(tx, peerTrip.commuterId, peerRawPts);

          await tx.trip.update({
            where: { id: peerTrip.id },
            data: {
              status: "VALIDATED",
              co2SavedGrams: peerCo2,
              ecoPointsEarned: peerEarned,
            },
          });

          if (peerEarned > 0) {
            await tx.pointTransaction.create({
              data: {
                commuterId: peerTrip.commuterId,
                amount: peerEarned,
                reason: "TRIP_VALIDATED",
                tripId: peerTrip.id,
              },
            });
            await tx.commuter.update({
              where: { id: peerTrip.commuterId },
              data: { ecoPointsBalance: { increment: peerEarned } },
            });
          }
        }

        await tx.carpoolSession.update({
          where: { id: linkedCarpoolSessionId },
          data: { status: "COMPLETED" },
        });
      }

      return tripRow!;
    });

    return toTripDto(insertedRow);
  }

  async listByCommuter(commuterId: string): Promise<TripDto[]> {
    const rows = await this.prisma.$queryRaw<TripRow[]>`
      SELECT
        id,
        "commuterId",
        "transportMode",
        status,
        ST_AsGeoJSON(route) AS route,
        "distanceMeters",
        "durationSeconds",
        "avgSpeedKmh",
        "peakSpeedKmh",
        "co2SavedGrams",
        "ecoPointsEarned",
        "rejectionReason",
        "carpoolSessionId",
        "startedAt",
        "endedAt",
        "createdAt"
      FROM "Trip"
      WHERE "commuterId" = ${commuterId}
      ORDER BY "createdAt" DESC, id DESC
    `;
    return rows.map(toTripDto);
  }

  async listByStatus(status?: TripStatusDto): Promise<TripDto[]> {
    const rows = status
      ? await this.prisma.$queryRaw<TripRow[]>`
          SELECT
            id,
            "commuterId",
            "transportMode",
            status,
            ST_AsGeoJSON(route) AS route,
            "distanceMeters",
            "durationSeconds",
            "avgSpeedKmh",
            "peakSpeedKmh",
            "co2SavedGrams",
            "ecoPointsEarned",
            "rejectionReason",
            "carpoolSessionId",
            "startedAt",
            "endedAt",
            "createdAt"
          FROM "Trip"
          WHERE status = ${status}::"TripStatus"
          ORDER BY "createdAt" DESC, id DESC
        `
      : await this.prisma.$queryRaw<TripRow[]>`
          SELECT
            id,
            "commuterId",
            "transportMode",
            status,
            ST_AsGeoJSON(route) AS route,
            "distanceMeters",
            "durationSeconds",
            "avgSpeedKmh",
            "peakSpeedKmh",
            "co2SavedGrams",
            "ecoPointsEarned",
            "rejectionReason",
            "carpoolSessionId",
            "startedAt",
            "endedAt",
            "createdAt"
          FROM "Trip"
          ORDER BY "createdAt" DESC, id DESC
        `;
    return rows.map(toTripDto);
  }

  async reviewTripStatus(
    tripId: string,
    targetStatus: "VALIDATED" | "REJECTED",
    rejectionReason?: string,
  ): Promise<TripDto> {
    const updatedRow = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.trip.findUnique({ where: { id: tripId } });
      if (!existing) {
        throw new TripStateTransitionError(404, "Viagem não encontrada.");
      }
      if (existing.status !== "PENDING_REVIEW") {
        throw new TripStateTransitionError(
          400,
          `Transição inválida: apenas viagens em PENDING_REVIEW podem ser revisadas (atual: ${existing.status}).`,
        );
      }

      const rule = MODE_RULES[existing.transportMode];
      let co2SavedGrams = 0;
      let ecoPointsEarned = 0;
      let finalRejectionReason: string | null = null;

      if (targetStatus === "VALIDATED") {
        co2SavedGrams =
          Math.round((existing.distanceMeters / 1000) * rule.co2GramsPerKm * 100) / 100;
        const rawPoints = Math.round((existing.distanceMeters / 1000) * rule.pointsPerKm);
        ecoPointsEarned = await computeCappedTripPoints(tx, existing.commuterId, rawPoints);
      } else {
        finalRejectionReason =
          rejectionReason ?? "MANAGER_REJECTED: Trajeto rejeitado na revisão do gestor.";
      }

      const [row] = await tx.$queryRaw<TripRow[]>`
        UPDATE "Trip"
        SET
          status = ${targetStatus}::"TripStatus",
          "co2SavedGrams" = ${co2SavedGrams}::float8,
          "ecoPointsEarned" = ${ecoPointsEarned}::int,
          "rejectionReason" = ${finalRejectionReason}
        WHERE id = ${tripId}
        RETURNING
          id,
          "commuterId",
          "transportMode",
          status,
          ST_AsGeoJSON(route) AS route,
          "distanceMeters",
          "durationSeconds",
          "avgSpeedKmh",
          "peakSpeedKmh",
          "co2SavedGrams",
          "ecoPointsEarned",
          "rejectionReason",
          "carpoolSessionId",
          "startedAt",
          "endedAt",
          "createdAt"
      `;

      if (targetStatus === "VALIDATED" && ecoPointsEarned > 0 && row) {
        await tx.pointTransaction.create({
          data: {
            commuterId: existing.commuterId,
            amount: ecoPointsEarned,
            reason: "TRIP_VALIDATED",
            tripId: row.id,
          },
        });
        await tx.commuter.update({
          where: { id: existing.commuterId },
          data: { ecoPointsBalance: { increment: ecoPointsEarned } },
        });
      }

      return row!;
    });

    return toTripDto(updatedRow);
  }

  async listLedgerByCommuter(commuterId: string): Promise<PointTransactionDto[]> {
    const rows = await this.prisma.pointTransaction.findMany({
      where: { commuterId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map((row) =>
      pointTransactionDtoSchema.parse({
        id: row.id,
        commuterId: row.commuterId,
        amount: row.amount,
        reason: row.reason,
        tripId: row.tripId,
        hazardReportId: row.hazardReportId,
        redemptionId: row.redemptionId,
        createdAt: row.createdAt.toISOString(),
      }),
    );
  }
}
