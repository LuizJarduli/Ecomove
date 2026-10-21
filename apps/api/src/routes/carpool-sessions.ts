import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Role } from "../auth/actor.js";
import {
  CarpoolDomainError,
  carpoolSessionDtoSchema,
  type CarpoolRepository,
} from "../carpool/carpool-repository.js";

const joinCarpoolBodySchema = z.object({
  joinCode: z.string().trim().min(4).max(4),
});

export function registerCarpoolRoutes(app: FastifyInstance, repo: CarpoolRepository) {
  app.post(
    "/v1/carpool-sessions",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      if (!request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Acesso restrito." });
      }
      const session = await repo.createSession(request.actor.id);
      return reply.code(201).send(carpoolSessionDtoSchema.parse(session));
    },
  );

  app.post(
    "/v1/carpool-sessions/join",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      const parsed = joinCarpoolBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_BODY",
          message: "Informe um código de carona válido de 4 caracteres.",
        });
      }
      if (!request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Acesso restrito." });
      }
      try {
        const session = await repo.joinByCode(request.actor.id, parsed.data.joinCode);
        return reply.code(200).send(carpoolSessionDtoSchema.parse(session));
      } catch (error) {
        if (error instanceof CarpoolDomainError) {
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
