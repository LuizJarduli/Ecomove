import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const ADMIN_URL = "postgresql://ecomove:ecomove@localhost:5432/postgres";
export const TEST_DATABASE_URL =
  "postgresql://ecomove:ecomove@localhost:5432/ecomove_test?schema=public";

export default async function setup() {
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
  try {
    await admin.$executeRawUnsafe("DROP DATABASE IF EXISTS ecomove_test WITH (FORCE)");
    await admin.$executeRawUnsafe("CREATE DATABASE ecomove_test");
  } finally {
    await admin.$disconnect();
  }
  execSync("pnpm exec prisma migrate deploy", {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}
