import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthVerifier } from "../auth/auth-verifier.js";

const bodySchema = z.object({ idToken: z.string().min(1) });

export function registerSessionRoutes(app: FastifyInstance, verifier: AuthVerifier) {
  app.post("/v1/auth/session", async (request, reply) => {
    const body = bodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "BAD_REQUEST", message: "idToken é obrigatório." });
    }
    try {
      return await verifier.createSession(body.data.idToken);
    } catch {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Token inválido." });
    }
  });
}
