import type { FastifyInstance } from "fastify";

export function registerMeRoutes(app: FastifyInstance) {
  app.get("/v1/me", { config: { requiresAuth: true } }, async (request) => request.actor);
}
