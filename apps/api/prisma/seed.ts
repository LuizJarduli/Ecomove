import { PrismaClient } from "@prisma/client";

/** FACENS campus + surrounding student corridor (approximate bounding polygon, SRID 4326). */
export const FACENS_POLYGON_WKT =
  "POLYGON((-47.4540 -23.4930, -47.4440 -23.4930, -47.4440 -23.4860, -47.4540 -23.4860, -47.4540 -23.4930))";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "CampusZone" WHERE name = 'Campus FACENS'`;
  if (Number(existing[0].count) === 0) {
    await prisma.$executeRaw`
      INSERT INTO "CampusZone" (id, name, boundary, "isActive")
      VALUES (gen_random_uuid()::text, 'Campus FACENS', ST_GeomFromText(${FACENS_POLYGON_WKT}, 4326), true)`;
  }

  await prisma.mobilityManager.upsert({
    where: { email: "gestor@facens.br" },
    create: { email: "gestor@facens.br", name: "Gestor de Mobilidade", department: "Infraestrutura do Campus" },
    update: {},
  });
}

main().finally(() => prisma.$disconnect());
