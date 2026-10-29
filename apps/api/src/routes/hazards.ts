import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Role } from "../auth/actor.js";
import {
  createHazardInputSchema,
  DuplicateNearbyHazardError,
  hazardCategorySchema,
  HazardDomainError,
  hazardReportDtoSchema,
  type HazardRepository,
} from "../hazards/hazard-repository.js";
import { MediaPayloadTooLargeError } from "../hazards/media-storage.js";

const hazardsListResponseSchema = z.object({
  hazards: z.array(hazardReportDtoSchema),
});

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  category: hazardCategorySchema,
});

const endorseParamsSchema = z.object({
  id: z.string().min(1),
});

const managerTransitionBodySchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "RESOLVED"]),
});

export function registerHazardRoutes(app: FastifyInstance, repo: HazardRepository) {
  app.get(
    "/v1/hazards",
    { config: { requiresAuth: true } },
    async () => {
      const hazards = await repo.listActive();
      return hazardsListResponseSchema.parse({ hazards });
    },
  );

  app.get(
    "/v1/hazards/nearby",
    { config: { requiresAuth: true } },
    async (request, reply) => {
      const parsed = nearbyQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_QUERY",
          message: "Informe lat, lng e category válidos.",
        });
      }
      const duplicate = await repo.findNearbyDuplicate({
        latitude: parsed.data.lat,
        longitude: parsed.data.lng,
        category: parsed.data.category,
      });
      return {
        duplicate: duplicate ? hazardReportDtoSchema.parse(duplicate) : null,
      };
    },
  );

  app.post(
    "/v1/hazards",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      const parsed = createHazardInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_BODY",
          message: "Dados da ocorrência inválidos.",
        });
      }
      if (!request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Acesso restrito." });
      }
      try {
        const created = await repo.createHazard(request.actor.id, parsed.data);
        return reply.code(201).send(hazardReportDtoSchema.parse(created));
      } catch (error) {
        if (error instanceof DuplicateNearbyHazardError) {
          return reply.code(409).send({
            error: "DUPLICATE_NEARBY_HAZARD",
            message: error.message,
            existingReport: error.existingReport,
          });
        }
        if (error instanceof MediaPayloadTooLargeError) {
          return reply.code(400).send({
            error: "PHOTO_TOO_LARGE",
            message: error.message,
          });
        }
        throw error;
      }
    },
  );

  app.post(
    "/v1/hazards/:id/endorse",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      const parsedParams = endorseParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.code(400).send({ error: "INVALID_PARAMS", message: "ID inválido." });
      }
      if (!request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Acesso restrito." });
      }
      try {
        const updated = await repo.endorseHazard(parsedParams.data.id, request.actor.id);
        return reply.code(200).send(hazardReportDtoSchema.parse(updated));
      } catch (error) {
        if (error instanceof HazardDomainError) {
          return reply.code(error.statusCode).send({
            error: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    },
  );

  app.patch(
    "/v1/manager/hazards/:id/status",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async (request, reply) => {
      const parsedParams = endorseParamsSchema.safeParse(request.params);
      const parsedBody = managerTransitionBodySchema.safeParse(request.body);
      if (!parsedParams.success || !parsedBody.success) {
        return reply.code(400).send({
          error: "INVALID_BODY",
          message: "Status de moderação inválido.",
        });
      }
      try {
        const updated = await repo.transitionStatus(
          parsedParams.data.id,
          parsedBody.data.status,
        );
        return reply.code(200).send(hazardReportDtoSchema.parse(updated));
      } catch (error) {
        if (error instanceof HazardDomainError) {
          return reply.code(error.statusCode).send({
            error: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    },
  );
}
