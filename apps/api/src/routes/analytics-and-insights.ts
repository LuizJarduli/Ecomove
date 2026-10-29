import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  analyticsOverviewDtoSchema,
  spatialHeatmapDtoSchema,
  type AnalyticsRepository,
} from "../analytics/analytics-repository.js";
import { Role } from "../auth/actor.js";
import {
  insightProviderSchema,
  mobilityInsightDtoSchema,
  resolveInsightEngine,
  type InsightEngine,
} from "../insights/insight-engine.js";

const overviewQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  institutionalOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const heatmapQuerySchema = z.object({
  institutionalOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const generateManagerInsightBodySchema = z
  .object({
    provider: insightProviderSchema.optional(),
    institutionalOnly: z.boolean().optional(),
  })
  .optional();

const commuterNudgeQuerySchema = z.object({
  provider: insightProviderSchema.optional(),
});

export function registerAnalyticsAndInsightRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  analyticsRepo: AnalyticsRepository,
  defaultInsightEngine?: InsightEngine,
) {
  app.get(
    "/v1/manager/analytics/overview",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async (request, reply) => {
      const parsed = overviewQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "INVALID_QUERY", message: "Filtros de análise inválidos." });
      }
      const overview = await analyticsRepo.getOverview({
        from: parsed.data.from ? new Date(parsed.data.from) : undefined,
        to: parsed.data.to ? new Date(parsed.data.to) : undefined,
        institutionalOnly: parsed.data.institutionalOnly,
      });
      return analyticsOverviewDtoSchema.parse(overview);
    },
  );

  app.get(
    "/v1/manager/analytics/spatial-heatmap",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async (request, reply) => {
      const parsed = heatmapQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "INVALID_QUERY", message: "Filtros de mapa de calor inválidos." });
      }
      const heatmap = await analyticsRepo.getSpatialHeatmap({
        institutionalOnly: parsed.data.institutionalOnly,
      });
      return spatialHeatmapDtoSchema.parse(heatmap);
    },
  );

  app.post(
    "/v1/manager/analytics/insights",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async (request, reply) => {
      const parsed = generateManagerInsightBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "INVALID_BODY", message: "Parâmetros de geração de insight inválidos." });
      }

      const institutionalOnly = parsed.data?.institutionalOnly ?? false;
      const overview = await analyticsRepo.getOverview({ institutionalOnly });
      const heatmap = await analyticsRepo.getSpatialHeatmap({ institutionalOnly });

      const engine = parsed.data?.provider
        ? resolveInsightEngine(parsed.data.provider)
        : (defaultInsightEngine ?? resolveInsightEngine());

      const generated = await engine.generateManagerInsight({
        overview,
        topHazards: heatmap.hazardClusters.slice(0, 5).map((h) => ({
          category: h.category,
          description: h.description,
          endorsementCount: h.endorsementCount,
        })),
      });

      const saved = await prisma.mobilityInsight.create({
        data: {
          audience: "MANAGER",
          provider: engine.providerName,
          summary: generated.summary,
          priorityCorridors: generated.priorityCorridors,
          recommendedActions: generated.recommendedActions,
        },
      });

      return reply.code(201).send(
        mobilityInsightDtoSchema.parse({
          id: saved.id,
          audience: saved.audience,
          provider: saved.provider,
          summary: saved.summary,
          priorityCorridors: saved.priorityCorridors as string[],
          recommendedActions: saved.recommendedActions as string[],
          createdAt: saved.createdAt.toISOString(),
        }),
      );
    },
  );

  app.get(
    "/v1/manager/analytics/insights",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async () => {
      const insights = await prisma.mobilityInsight.findMany({
        where: { audience: "MANAGER" },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      return {
        insights: insights.map((s) =>
          mobilityInsightDtoSchema.parse({
            id: s.id,
            audience: s.audience,
            provider: s.provider,
            summary: s.summary,
            priorityCorridors: s.priorityCorridors as string[],
            recommendedActions: s.recommendedActions as string[],
            createdAt: s.createdAt.toISOString(),
          }),
        ),
      };
    },
  );

  app.get(
    "/v1/commuters/me/nudge",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      const parsed = commuterNudgeQuerySchema.safeParse(request.query);
      if (!parsed.success || !request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(400).send({ error: "INVALID_QUERY", message: "Parâmetros inválidos." });
      }

      const commuter = await prisma.commuter.findUnique({
        where: { id: request.actor.id },
      });
      if (!commuter) {
        return reply.code(404).send({ error: "COMMUTER_NOT_FOUND", message: "Usuário não encontrado." });
      }

      const validatedTrips = await prisma.trip.findMany({
        where: { commuterId: commuter.id, status: "VALIDATED" },
        select: { distanceMeters: true, co2SavedGrams: true },
      });

      const totalDistanceMeters = validatedTrips.reduce((s, t) => s + t.distanceMeters, 0);
      const totalCo2SavedGrams = validatedTrips.reduce((s, t) => s + t.co2SavedGrams, 0);

      const affordableRewards = await prisma.reward.findMany({
        where: {
          isActive: true,
          stock: { gt: 0 },
          costEcoPoints: { lte: Math.max(commuter.ecoPointsBalance, 200) },
        },
        orderBy: { costEcoPoints: "asc" },
        take: 3,
        select: { title: true, costEcoPoints: true },
      });

      const engine = parsed.data.provider
        ? resolveInsightEngine(parsed.data.provider)
        : (defaultInsightEngine ?? resolveInsightEngine());

      const generated = await engine.generateCommuterNudge({
        commuterId: commuter.id,
        name: commuter.name,
        ecoPointsBalance: commuter.ecoPointsBalance,
        totalDistanceMeters,
        totalCo2SavedGrams,
        recentTripCount: validatedTrips.length,
        affordableRewards,
      });

      const saved = await prisma.mobilityInsight.create({
        data: {
          audience: "COMMUTER",
          commuterId: commuter.id,
          provider: engine.providerName,
          summary: generated.summary,
          priorityCorridors: generated.priorityCorridors,
          recommendedActions: generated.recommendedActions,
        },
      });

      return mobilityInsightDtoSchema.parse({
        id: saved.id,
        audience: saved.audience,
        provider: saved.provider,
        summary: saved.summary,
        priorityCorridors: saved.priorityCorridors as string[],
        recommendedActions: saved.recommendedActions as string[],
        createdAt: saved.createdAt.toISOString(),
      });
    },
  );
}
