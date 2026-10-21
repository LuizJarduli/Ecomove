import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Role } from "../auth/actor.js";

const meResponseSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal(Role.Commuter),
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    isInstitutional: z.boolean(),
    ecoPointsBalance: z.number().int(),
    totalDistanceMeters: z.number(),
    totalCo2SavedGrams: z.number(),
  }),
  z.object({
    role: z.literal(Role.MobilityManager),
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    department: z.string().nullable(),
  }),
]);

export function registerMeRoutes(app: FastifyInstance) {
  app.get("/v1/me", { config: { requiresAuth: true } }, async (request) =>
    meResponseSchema.parse(request.actor),
  );
}
