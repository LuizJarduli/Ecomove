import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestContext, seedCampusZone, type TestContext } from "./helpers.js";

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
  await ctx.prisma.mobilityManager.create({ data: { email: "ricardo@facens.br", name: "Ricardo" } });
  await seedCampusZone(ctx.prisma);
});
afterAll(async () => {
  await ctx?.close();
});

describe("GET /v1/campus-zones/active", () => {
  it("returns the active CampusZone boundary as GeoJSON from PostGIS", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/campus-zones/active",
      headers: ctx.bearer("ana@facens.br"),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("Campus FACENS");
    expect(body.boundary.type).toBe("Polygon");
    expect(body.boundary.coordinates[0]).toHaveLength(5);
    expect(body.boundary.coordinates[0][0]).toEqual([-47.454, -23.493]);
  });

  it("requires authentication", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/v1/campus-zones/active" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when no CampusZone is active", async () => {
    await ctx.prisma.$executeRaw`UPDATE "CampusZone" SET "isActive" = false`;
    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/campus-zones/active",
      headers: ctx.bearer("ana@facens.br"),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("manager-protected routes", () => {
  it("forbids a Commuter", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/manager/campus-zones",
      headers: ctx.bearer("ana@facens.br"),
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows a MobilityManager", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/manager/campus-zones",
      headers: ctx.bearer("ricardo@facens.br"),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});
