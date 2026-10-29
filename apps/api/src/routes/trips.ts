import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Role } from "../auth/actor.js";
import {
  createTripInputSchema,
  InvalidTripTrajectoryError,
  pointTransactionDtoSchema,
  tripDtoSchema,
  TripStateTransitionError,
  tripStatusSchema,
  type TripRepository,
} from "../trips/trip-repository.js";

const tripsListResponseSchema = z.object({
  trips: z.array(tripDtoSchema),
});

const ledgerListResponseSchema = z.object({
  transactions: z.array(pointTransactionDtoSchema),
});

const managerTripsQuerySchema = z.object({
  status: tripStatusSchema.optional(),
});

const tripIdParamsSchema = z.object({
  id: z.string().min(1),
});

const managerReviewTripBodySchema = z.object({
  status: z.enum(["VALIDATED", "REJECTED"]),
  rejectionReason: z.string().optional(),
});

export function registerTripRoutes(app: FastifyInstance, repo: TripRepository) {
  app.post(
    "/v1/trips",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      const parsed = createTripInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_BODY",
          message: "Dados de trajeto inválidos. Envie ao menos 2 pontos GPS com horário válido.",
        });
      }

      if (!request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Acesso restrito." });
      }

      try {
        const trip = await repo.recordTrip(request.actor.id, parsed.data);
        return reply.code(201).send(tripDtoSchema.parse(trip));
      } catch (error) {
        if (error instanceof InvalidTripTrajectoryError) {
          return reply.code(400).send({
            error: "INVALID_TRAJECTORY",
            message: error.message,
          });
        }
        throw error;
      }
    },
  );

  app.get(
    "/v1/trips/me",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      if (!request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Acesso restrito." });
      }
      const trips = await repo.listByCommuter(request.actor.id);
      return tripsListResponseSchema.parse({ trips });
    },
  );

  app.get(
    "/v1/ledger/me",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      if (!request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Acesso restrito." });
      }
      const transactions = await repo.listLedgerByCommuter(request.actor.id);
      return ledgerListResponseSchema.parse({ transactions });
    },
  );

  app.get(
    "/v1/manager/trips",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async (request, reply) => {
      const parsedQuery = managerTripsQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.code(400).send({ error: "INVALID_QUERY", message: "Filtro de status inválido." });
      }
      const trips = await repo.listByStatus(parsedQuery.data.status);
      return tripsListResponseSchema.parse({ trips });
    },
  );

  app.patch(
    "/v1/manager/trips/:id/status",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async (request, reply) => {
      const parsedParams = tripIdParamsSchema.safeParse(request.params);
      const parsedBody = managerReviewTripBodySchema.safeParse(request.body);
      if (!parsedParams.success || !parsedBody.success) {
        return reply.code(400).send({
          error: "INVALID_BODY",
          message: "Informe um status válido (VALIDATED ou REJECTED).",
        });
      }
      try {
        const updated = await repo.reviewTripStatus(
          parsedParams.data.id,
          parsedBody.data.status,
          parsedBody.data.rejectionReason,
        );
        return reply.code(200).send(tripDtoSchema.parse(updated));
      } catch (error) {
        if (error instanceof TripStateTransitionError) {
          return reply.code(error.statusCode).send({
            error: "INVALID_TRIP_TRANSITION",
            message: error.message,
          });
        }
        throw error;
      }
    },
  );
}
