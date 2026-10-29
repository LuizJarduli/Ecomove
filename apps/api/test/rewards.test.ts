import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestContext, seedCampusZone, type TestContext } from "./helpers.js";

describe("Slice 6 — Partner & Reward Catalog, Atomic Redemption Vouchers & 7-Day Auto-Refund", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    await seedCampusZone(ctx.prisma);
    await ctx.prisma.mobilityManager.create({
      data: {
        email: "ricardo@facens.br",
        name: "Ricardo Fontoura",
        department: "Sustentabilidade",
      },
    });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("allows MobilityManager to create Partner & Reward, Commuter to redeem atomically with FOR UPDATE lock, and sweeps expired vouchers with REDEMPTION_EXPIRED_REFUND", async () => {
    const manager = ctx.bearer("ricardo@facens.br");
    const beatriz = ctx.bearer("beatriz@facens.br");
    const lucas = ctx.bearer("lucas@facens.br");

    // 1. MobilityManager creates Partner and Reward (stock: 1, costEcoPoints: 20)
    const partnerRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/manager/partners",
      headers: manager,
      payload: {
        name: "Cantina Central FACENS",
        category: "Alimentação",
        address: "Bloco A — Térreo",
      },
    });
    expect(partnerRes.statusCode).toBe(201);
    const partner = partnerRes.json();

    const rewardRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/manager/rewards",
      headers: manager,
      payload: {
        partnerId: partner.id,
        title: "Café Expresso + Pão de Queijo",
        description: "Combo matinal sustentável",
        costEcoPoints: 20,
        stock: 1,
      },
    });
    expect(rewardRes.statusCode).toBe(201);
    const reward = rewardRes.json();
    expect(reward.stock).toBe(1);

    // 2. Beatriz tries to redeem with 0 EcoPoints -> 400 INSUFFICIENT_BALANCE
    const noBalanceRes = await ctx.app.inject({
      method: "POST",
      url: `/v1/rewards/${reward.id}/redeem`,
      headers: beatriz,
    });
    expect(noBalanceRes.statusCode).toBe(400);
    expect(noBalanceRes.json().error).toBe("INSUFFICIENT_BALANCE");

    // 3. Beatriz and Lucas both earn 25 EcoPoints from approved HazardReports
    for (const [header, lat] of [
      [beatriz, -23.49] as const,
      [lucas, -23.492] as const,
    ]) {
      const hRes = await ctx.app.inject({
        method: "POST",
        url: "/v1/hazards",
        headers: header,
        payload: {
          category: "SIDEWALK_DAMAGE",
          description: "Piso irregular no acesso",
          latitude: lat,
          longitude: -47.45,
        },
      });
      await ctx.app.inject({
        method: "PATCH",
        url: `/v1/manager/hazards/${hRes.json().id}/status`,
        headers: manager,
        payload: { status: "APPROVED" },
      });
    }

    // 4. Beatriz redeems the last stock item -> 201 Created, balance becomes 5, stock becomes 0
    const redeemRes = await ctx.app.inject({
      method: "POST",
      url: `/v1/rewards/${reward.id}/redeem`,
      headers: beatriz,
    });
    expect(redeemRes.statusCode).toBe(201);
    const redemption = redeemRes.json();
    expect(redemption.status).toBe("ACTIVE");
    expect(redemption.voucherCode).toHaveLength(8);
    expect(redemption.costEcoPoints).toBe(20);

    // 5. Lucas tries to redeem when stock is 0 -> 400 INSUFFICIENT_STOCK
    const outOfStockRes = await ctx.app.inject({
      method: "POST",
      url: `/v1/rewards/${reward.id}/redeem`,
      headers: lucas,
    });
    expect(outOfStockRes.statusCode).toBe(400);
    expect(outOfStockRes.json().error).toBe("INSUFFICIENT_STOCK");

    // 6. Fast-forward expiresAt to the past and run sweep-expired -> transitions to EXPIRED, restores stock to 1, and refunds 20 EcoPoints to Beatriz
    await ctx.prisma.redemption.update({
      where: { id: redemption.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const sweepRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/manager/redemptions/sweep-expired",
      headers: manager,
    });
    expect(sweepRes.statusCode).toBe(200);
    expect(sweepRes.json().refundedCount).toBe(1);

    // Verify Beatriz balance is restored to 25 and ledger has REDEMPTION_EXPIRED_REFUND
    const meBeatriz = (
      await ctx.app.inject({ method: "GET", url: "/v1/me", headers: beatriz })
    ).json();
    expect(meBeatriz.ecoPointsBalance).toBe(25);
    const ledgerBeatriz = (
      await ctx.app.inject({ method: "GET", url: "/v1/ledger/me", headers: beatriz })
    ).json();
    expect(
      ledgerBeatriz.transactions.some(
        (tx: { reason: string; amount: number }) =>
          tx.reason === "REDEMPTION_EXPIRED_REFUND" && tx.amount === 20,
      ),
    ).toBe(true);

    // Verify stock is restored to 1 so Lucas can now redeem and mark as USED
    const lucasRedeemRes = await ctx.app.inject({
      method: "POST",
      url: `/v1/rewards/${reward.id}/redeem`,
      headers: lucas,
    });
    expect(lucasRedeemRes.statusCode).toBe(201);
    const lucasVoucher = lucasRedeemRes.json();

    const useRes = await ctx.app.inject({
      method: "POST",
      url: `/v1/redemptions/${lucasVoucher.id}/use`,
      headers: lucas,
    });
    expect(useRes.statusCode).toBe(200);
    expect(useRes.json().status).toBe("USED");
    expect(useRes.json().usedAt).not.toBeNull();
  });
});
