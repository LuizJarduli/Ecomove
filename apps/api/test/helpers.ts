import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { FakeAuthVerifier } from "../src/auth/fake-auth-verifier.js";
import { TEST_DATABASE_URL } from "./global-setup.js";

export const FACENS_POLYGON_WKT =
  "POLYGON((-47.4540 -23.4930, -47.4440 -23.4930, -47.4440 -23.4860, -47.4540 -23.4860, -47.4540 -23.4930))";

export interface TestContext {
  app: FastifyInstance;
  prisma: PrismaClient;
  bearer(email: string, uid?: string): { authorization: string };
  close(): Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Commuter", "MobilityManager", "CampusZone" RESTART IDENTITY CASCADE',
  );
  const verifier = new FakeAuthVerifier();
  const app = await buildApp({ prisma, authVerifier: verifier });
  return {
    app,
    prisma,
    bearer: (email, uid = `uid-${email}`) => ({
      authorization: `Bearer ${FakeAuthVerifier.tokenFor(uid, email)}`,
    }),
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

export async function seedCampusZone(prisma: PrismaClient) {
  await prisma.$executeRaw`
    INSERT INTO "CampusZone" (id, name, boundary, "isActive")
    VALUES (gen_random_uuid()::text, 'Campus FACENS', ST_GeomFromText(${FACENS_POLYGON_WKT}, 4326), true)`;
}
