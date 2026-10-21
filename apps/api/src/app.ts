import type { PrismaClient } from "@prisma/client";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { AuthVerifier } from "./auth/auth-verifier.js";
import { registerAuth, type Role } from "./auth/actor.js";
import { registerSessionRoutes } from "./routes/session.js";
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
  /** Browser origins allowed to call the API directly (e.g. mobile web); CORS stays off when unset. */
  corsOrigins?: string[];
}

export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify();
  if (deps.corsOrigins) await app.register(cors, { origin: deps.corsOrigins });
  registerAuth(app, deps.prisma, deps.authVerifier);
  registerSessionRoutes(app, deps.authVerifier);
  registerMeRoutes(app);
  registerCampusZoneRoutes(app, new CampusZoneRepository(deps.prisma));
  await app.ready();
  return app;
}
