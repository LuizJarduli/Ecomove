import type { FastifyInstance } from "fastify";
import { Role } from "../auth/actor.js";
import type { CampusZoneRepository } from "../campus-zones/campus-zone-repository.js";

export function registerCampusZoneRoutes(app: FastifyInstance, zones: CampusZoneRepository) {
  app.get("/v1/campus-zones/active", { config: { requiresAuth: true } }, async (_request, reply) => {
    const zone = await zones.findActive();
    if (!zone) {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Nenhuma zona de campus ativa." });
    }
    return zone;
  });

  app.get(
    "/v1/manager/campus-zones",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async () => zones.listAll(),
  );
}
