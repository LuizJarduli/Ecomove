import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { FakeAuthVerifier } from "../src/auth/fake-auth-verifier.js";
import { insertFacensZone } from "../src/campus-zones/facens-zone.js";
import { TEST_DATABASE_URL } from "./global-setup.js";

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

export const seedCampusZone = insertFacensZone;
