import type { PrismaClient } from "@prisma/client";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { AuthVerifier } from "./auth/auth-verifier.js";
import { registerAuth, type Role } from "./auth/actor.js";
import { registerMeRoutes } from "./routes/me.js";
import { CampusZoneRepository } from "./campus-zones/campus-zone-repository.js";
import { registerCampusZoneRoutes } from "./routes/campus-zones.js";

declare module "fastify" {
  interface FastifyContextConfig {
    requiresAuth?: boolean;
    requiresRole?: Role;
  }
}

export interface AppDependencies {
  prisma: PrismaClient;
  authVerifier: AuthVerifier;
  /** Allowed browser origins (web portal); defaults to any origin for local dev and tests. */
  corsOrigins?: string[];
}

export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cors, { origin: deps.corsOrigins ?? true });
  registerAuth(app, deps.prisma, deps.authVerifier);
  registerMeRoutes(app);
  registerCampusZoneRoutes(app, new CampusZoneRepository(deps.prisma));
  await app.ready();
  return app;
}
