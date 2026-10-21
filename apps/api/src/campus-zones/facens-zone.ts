import type { PrismaClient } from "@prisma/client";

export const FACENS_ZONE_NAME = "Campus FACENS";

/** FACENS campus + surrounding student corridor (approximate bounding polygon, SRID 4326). */
export const FACENS_POLYGON_WKT =
  "POLYGON((-47.4540 -23.4930, -47.4440 -23.4930, -47.4440 -23.4860, -47.4540 -23.4860, -47.4540 -23.4930))";

export async function insertFacensZone(prisma: PrismaClient) {
  await prisma.$executeRaw`
    INSERT INTO "CampusZone" (id, name, boundary, "isActive")
    VALUES (gen_random_uuid()::text, ${FACENS_ZONE_NAME}, ST_GeomFromText(${FACENS_POLYGON_WKT}, 4326), true)`;
}
