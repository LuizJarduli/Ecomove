import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./helpers.js";

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx?.close();
});

describe("GET /v1/me", () => {
  it("creates a Commuter on first login and flags @facens.br as institutional", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/me",
      headers: ctx.bearer("ana@facens.br"),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      role: "COMMUTER",
      email: "ana@facens.br",
      isInstitutional: true,
      ecoPointsBalance: 0,
    });
  });

  it("does not flag external residents as institutional", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/me",
      headers: ctx.bearer("rita@gmail.com"),
    });

    expect(res.json()).toMatchObject({ role: "COMMUTER", isInstitutional: false });
  });

  it("reuses the same Commuter across logins", async () => {
    await ctx.app.inject({ method: "GET", url: "/v1/me", headers: ctx.bearer("ana@facens.br") });
    const res = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: ctx.bearer("ana@facens.br") });

    expect(res.statusCode).toBe(200);
    expect(await ctx.prisma.commuter.count()).toBe(1);
  });

  it("recognizes a pre-registered MobilityManager", async () => {
    await ctx.prisma.mobilityManager.create({ data: { email: "ricardo@facens.br", name: "Ricardo" } });

    const res = await ctx.app.inject({
      method: "GET",
      url: "/v1/me",
      headers: ctx.bearer("ricardo@facens.br"),
    });

    expect(res.json()).toMatchObject({ role: "MOBILITY_MANAGER", email: "ricardo@facens.br" });
    expect(await ctx.prisma.commuter.count()).toBe(0);
  });

  it("rejects requests without a valid token", async () => {
    const missing = await ctx.app.inject({ method: "GET", url: "/v1/me" });
    const invalid = await ctx.app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: "Bearer garbage" },
    });

    expect(missing.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
  });
});
