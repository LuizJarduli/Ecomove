import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FakeAuthVerifier } from "../src/auth/fake-auth-verifier.js";
import { createTestContext, type TestContext } from "./helpers.js";

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx?.close();
});

describe("POST /v1/auth/session", () => {
  it("exchanges a valid ID token for a session credential accepted as Bearer token", async () => {
    const exchange = await ctx.app.inject({
      method: "POST",
      url: "/v1/auth/session",
      payload: { idToken: FakeAuthVerifier.tokenFor("uid-1", "ana@facens.br") },
    });

    expect(exchange.statusCode).toBe(200);
    const { sessionCookie, expiresInMs } = exchange.json();
    expect(typeof sessionCookie).toBe("string");
    expect(expiresInMs).toBeGreaterThan(0);

    const me = await ctx.app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${sessionCookie}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email: "ana@facens.br" });
  });

  it("rejects an invalid ID token", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/auth/session",
      payload: { idToken: "garbage" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a malformed body", async () => {
    const res = await ctx.app.inject({ method: "POST", url: "/v1/auth/session", payload: {} });
    expect(res.statusCode).toBe(400);
  });
});
