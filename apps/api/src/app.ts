import type { PrismaClient } from "@prisma/client";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { AuthVerifier } from "./auth/auth-verifier.js";
import { registerAuth, type Role } from "./auth/actor.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerMeRoutes } from "./routes/me.js";
import { CampusZoneRepository } from "./campus-zones/campus-zone-repository.js";
import { registerCampusZoneRoutes } from "./routes/campus-zones.js";
import { TripRepository } from "./trips/trip-repository.js";
import { registerTripRoutes } from "./routes/trips.js";
import { CarpoolRepository } from "./carpool/carpool-repository.js";
import { registerCarpoolRoutes } from "./routes/carpool-sessions.js";
import { HazardRepository } from "./hazards/hazard-repository.js";
import { LocalSparkMediaStorageService } from "./hazards/media-storage.js";
import { registerHazardRoutes } from "./routes/hazards.js";
import { RewardRepository } from "./rewards/reward-repository.js";
import { registerRewardRoutes } from "./routes/rewards.js";
import { AnalyticsRepository } from "./analytics/analytics-repository.js";
import { registerAnalyticsAndInsightRoutes } from "./routes/analytics-and-insights.js";
import type { InsightEngine } from "./insights/insight-engine.js";

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
  insightEngine?: InsightEngine;
}

export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify();
  if (deps.corsOrigins) await app.register(cors, { origin: deps.corsOrigins });
  registerAuth(app, deps.prisma, deps.authVerifier);
  registerSessionRoutes(app, deps.authVerifier);
  registerMeRoutes(app);
  registerCampusZoneRoutes(app, new CampusZoneRepository(deps.prisma));
  registerTripRoutes(app, new TripRepository(deps.prisma));
  registerCarpoolRoutes(app, new CarpoolRepository(deps.prisma));
  registerHazardRoutes(
    app,
    new HazardRepository(deps.prisma, new LocalSparkMediaStorageService()),
  );
  registerRewardRoutes(app, new RewardRepository(deps.prisma));
  registerAnalyticsAndInsightRoutes(
    app,
    deps.prisma,
    new AnalyticsRepository(deps.prisma),
    deps.insightEngine,
  );
  await app.ready();
  return app;
}
