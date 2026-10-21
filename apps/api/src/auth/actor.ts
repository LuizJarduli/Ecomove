import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthVerifier } from "./auth-verifier.js";

export const Role = { Commuter: "COMMUTER", MobilityManager: "MOBILITY_MANAGER" } as const;
export type Role = (typeof Role)[keyof typeof Role];

const BEARER_PREFIX = "Bearer ";

/** Raised when a verified identity conflicts with an existing actor record. */
export class IdentityConflictError extends Error {
  constructor(readonly statusCode: 401 | 409, message: string) {
    super(message);
  }
}

export type Actor =
  | {
      role: typeof Role.Commuter;
      id: string;
      email: string;
      name: string | null;
      isInstitutional: boolean;
      ecoPointsBalance: number;
      totalDistanceMeters: number;
      totalCo2SavedGrams: number;
    }
  | { role: typeof Role.MobilityManager; id: string; email: string; name: string | null; department: string | null };

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
    } else if (manager.firebaseUid !== identity.uid) {
      throw new IdentityConflictError(401, "Identidade não corresponde ao gestor registrado.");
    }
    return {
      role: Role.MobilityManager,
      id: manager.id,
      email: manager.email,
      name: manager.name,
      department: manager.department,
    };
  }

  const emailOwner = await prisma.commuter.findUnique({ where: { email } });
  if (emailOwner && emailOwner.firebaseUid !== identity.uid) {
    throw new IdentityConflictError(409, "E-mail já associado a outra conta.");
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
    role: Role.Commuter,
    id: commuter.id,
    email: commuter.email,
    name: commuter.name,
    isInstitutional: commuter.isInstitutional,
    ecoPointsBalance: commuter.ecoPointsBalance,
    // Derived from validated Trips once Trip recording lands (ticket #3).
    totalDistanceMeters: 0,
    totalCo2SavedGrams: 0,
  };
}

export function registerAuth(app: FastifyInstance, prisma: PrismaClient, verifier: AuthVerifier) {
  app.decorateRequest("actor", undefined);

  app.addHook("preHandler", async (request: FastifyRequest, reply) => {
    const { requiresAuth, requiresRole } = request.routeOptions.config;
    if (!requiresAuth) return;

    const header = request.headers.authorization;
    if (!header?.startsWith(BEARER_PREFIX)) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Token ausente." });
    }

    let identity;
    try {
      identity = await verifier.verify(header.slice(BEARER_PREFIX.length));
    } catch {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Token inválido." });
    }

    try {
      request.actor = await resolveActor(prisma, identity);
    } catch (error) {
      if (error instanceof IdentityConflictError) {
        return reply.code(error.statusCode).send({ error: "IDENTITY_CONFLICT", message: error.message });
      }
      throw error;
    }

    if (requiresRole && request.actor.role !== requiresRole) {
      return reply.code(403).send({ error: "FORBIDDEN", message: "Acesso restrito." });
    }
  });
}
