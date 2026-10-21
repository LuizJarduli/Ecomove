import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthVerifier } from "./auth-verifier.js";

export type Actor =
  | {
      role: "COMMUTER";
      id: string;
      email: string;
      name: string | null;
      isInstitutional: boolean;
      ecoPointsBalance: number;
    }
  | { role: "MOBILITY_MANAGER"; id: string; email: string; name: string | null; department: string | null };

declare module "fastify" {
  interface FastifyRequest {
    actor?: Actor;
  }
}

export const INSTITUTIONAL_DOMAIN = "@facens.br";

/** Resolves the authenticated actor: a pre-registered MobilityManager, otherwise an upserted Commuter. */
export async function resolveActor(
  prisma: PrismaClient,
  identity: { uid: string; email: string; name?: string },
): Promise<Actor> {
  const email = identity.email.toLowerCase();

  const manager = await prisma.mobilityManager.findUnique({ where: { email } });
  if (manager) {
    if (!manager.firebaseUid) {
      await prisma.mobilityManager.update({
        where: { id: manager.id },
        data: { firebaseUid: identity.uid },
      });
    }
    return {
      role: "MOBILITY_MANAGER",
      id: manager.id,
      email: manager.email,
      name: manager.name,
      department: manager.department,
    };
  }

  const commuter = await prisma.commuter.upsert({
    where: { firebaseUid: identity.uid },
    create: {
      firebaseUid: identity.uid,
      email,
      name: identity.name ?? null,
      isInstitutional: email.endsWith(INSTITUTIONAL_DOMAIN),
    },
    update: {},
  });
  return {
    role: "COMMUTER",
    id: commuter.id,
    email: commuter.email,
    name: commuter.name,
    isInstitutional: commuter.isInstitutional,
    ecoPointsBalance: commuter.ecoPointsBalance,
  };
}

export function registerAuth(app: FastifyInstance, prisma: PrismaClient, verifier: AuthVerifier) {
  app.decorateRequest("actor", undefined);

  app.addHook("preHandler", async (request: FastifyRequest, reply) => {
    if (!request.routeOptions.config.requiresAuth) return;
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Token ausente." });
    }
    try {
      const identity = await verifier.verify(header.slice("Bearer ".length));
      request.actor = await resolveActor(prisma, identity);
    } catch {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Token inválido." });
    }
    if (request.routeOptions.config.requiresRole && request.actor.role !== request.routeOptions.config.requiresRole) {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Acesso restrito." });
    }
  });
}
