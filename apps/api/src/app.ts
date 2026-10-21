import type { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyInstance } from "fastify";
import type { AuthVerifier } from "./auth/auth-verifier.js";
import { registerAuth, type Actor } from "./auth/actor.js";
import { registerMeRoutes } from "./routes/me.js";
import { CampusZoneRepository } from "./campus-zones/campus-zone-repository.js";
import { registerCampusZoneRoutes } from "./routes/campus-zones.js";

declare module "fastify" {
  interface FastifyContextConfig {
    requiresAuth?: boolean;
    requiresRole?: Actor["role"];
  }
}

export interface AppDependencies {
  prisma: PrismaClient;
  authVerifier: AuthVerifier;
}

export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify();
  registerAuth(app, deps.prisma, deps.authVerifier);
  registerMeRoutes(app);
  registerCampusZoneRoutes(app, new CampusZoneRepository(deps.prisma));
  await app.ready();
  return app;
}
