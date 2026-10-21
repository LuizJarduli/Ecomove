import { PrismaClient } from "@prisma/client";
import { FACENS_ZONE_NAME, insertFacensZone } from "../src/campus-zones/facens-zone.js";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "CampusZone" WHERE name = ${FACENS_ZONE_NAME}`;
  if (Number(existing[0].count) === 0) {
    await insertFacensZone(prisma);
  }

  await prisma.mobilityManager.upsert({
    where: { email: "gestor@facens.br" },
    create: { email: "gestor@facens.br", name: "Gestor de Mobilidade", department: "Infraestrutura do Campus" },
    update: {},
  });

  await prisma.commuter.upsert({
    where: { email: "aluno@facens.br" },
    create: {
      firebaseUid: "demo-commuter-uid",
      email: "aluno@facens.br",
      name: "Aluno Demo",
      isInstitutional: true,
    },
    update: {},
  });
}

main().finally(() => prisma.$disconnect());
