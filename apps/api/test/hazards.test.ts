import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestContext, seedCampusZone, type TestContext } from "./helpers.js";

describe("Slices 4 & 5 — HazardReport 30m Deduplication, HazardEndorsement & MobilityManager Moderation", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    await seedCampusZone(ctx.prisma);
    await ctx.prisma.mobilityManager.create({
      data: {
        email: "ricardo@facens.br",
        name: "Ricardo Fontoura",
        department: "Infraestrutura",
      },
    });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("detects nearby duplicates within 30m (20m triggers 409 Conflict; 50m allows new HazardReport) and increments endorsementCount", async () => {
    const beatriz = ctx.bearer("beatriz@facens.br");
    const lucas = ctx.bearer("lucas@facens.br");

    // 1. Beatriz reports a BIKE_LANE_OBSTRUCTION at (-23.4900, -47.4500) with compressed WebP (< 300 KB)
    const smallWebpBase64 = Buffer.from("RIFF_WEBP_MOCK_PAYLOAD").toString("base64");
    const firstRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/hazards",
      headers: beatriz,
      payload: {
        category: "BIKE_LANE_OBSTRUCTION",
        description: "Entulho bloqueando ciclovia norte (Bloco E)",
        latitude: -23.49,
        longitude: -47.45,
        photoDataBase64: smallWebpBase64,
      },
    });
    expect(firstRes.statusCode).toBe(201);
    const hazard = firstRes.json();
    expect(hazard.status).toBe("PENDING");
    expect(hazard.endorsementCount).toBe(1);
    expect(hazard.photoUrl).toMatch(/^\/media\/hazards\/.+\.webp$/);

    // 2. Lucas checks /v1/hazards/nearby ~20m away (-47.4500 -> -47.44981 is ~19.4 meters)
    const nearby20m = await ctx.app.inject({
      method: "GET",
      url: "/v1/hazards/nearby?lat=-23.49&lng=-47.44981&category=BIKE_LANE_OBSTRUCTION",
      headers: lucas,
    });
    expect(nearby20m.statusCode).toBe(200);
    expect(nearby20m.json().duplicate?.id).toBe(hazard.id);

    // 3. Submitting at ~20m without forceCreate returns 409 Conflict with existingReport
    const dupSubmitRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/hazards",
      headers: lucas,
      payload: {
        category: "BIKE_LANE_OBSTRUCTION",
        description: "Mesmo entulho na ciclovia",
        latitude: -23.49,
        longitude: -47.44981,
      },
    });
    expect(dupSubmitRes.statusCode).toBe(409);
    expect(dupSubmitRes.json().existingReport.id).toBe(hazard.id);

    // 4. Lucas endorses the existing report -> endorsementCount becomes 2, duplicate endorsement returns 409
    const endorseRes = await ctx.app.inject({
      method: "POST",
      url: `/v1/hazards/${hazard.id}/endorse`,
      headers: lucas,
    });
    expect(endorseRes.statusCode).toBe(200);
    expect(endorseRes.json().endorsementCount).toBe(2);

    const doubleEndorseRes = await ctx.app.inject({
      method: "POST",
      url: `/v1/hazards/${hazard.id}/endorse`,
      headers: lucas,
    });
    expect(doubleEndorseRes.statusCode).toBe(409);

    // 5. Submitting ~50m away (-47.4500 -> -47.44950 is ~51 meters) creates a new HazardReport
    const farSubmitRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/hazards",
      headers: lucas,
      payload: {
        category: "BIKE_LANE_OBSTRUCTION",
        description: "Outro obstáculo 50m adiante",
        latitude: -23.49,
        longitude: -47.4495,
      },
    });
    expect(farSubmitRes.statusCode).toBe(201);
    expect(farSubmitRes.json().id).not.toBe(hazard.id);
  });

  it("rejects images larger than 300 KB (ADR-0005 Spark plan compliance)", async () => {
    const beatriz = ctx.bearer("beatriz@facens.br");
    const oversizedBase64 = Buffer.alloc(310 * 1024, 1).toString("base64");

    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/hazards",
      headers: beatriz,
      payload: {
        category: "SIDEWALK_DAMAGE",
        description: "Buraco na calçada",
        latitude: -23.49,
        longitude: -47.45,
        photoDataBase64: oversizedBase64,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("PHOTO_TOO_LARGE");
  });

  it("allows MobilityManager to approve HazardReport (+25 EcoPoints ledger entry), transition to RESOLVED, and review PENDING_REVIEW Trips", async () => {
    const beatriz = ctx.bearer("beatriz@facens.br");
    const manager = ctx.bearer("ricardo@facens.br");

    // 1. Beatriz creates a PENDING HazardReport
    const createHazardRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/hazards",
      headers: beatriz,
      payload: {
        category: "POOR_LIGHTING",
        description: "Poste apagado próximo ao estacionamento",
        latitude: -23.49,
        longitude: -47.45,
      },
    });
    const hazardId = createHazardRes.json().id;

    // 2. MobilityManager approves HazardReport -> awards +25 EcoPoints via HAZARD_APPROVED PointTransaction
    const approveRes = await ctx.app.inject({
      method: "PATCH",
      url: `/v1/manager/hazards/${hazardId}/status`,
      headers: manager,
      payload: { status: "APPROVED" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe("APPROVED");

    // Double-approving is rejected with 400
    const doubleApproveRes = await ctx.app.inject({
      method: "PATCH",
      url: `/v1/manager/hazards/${hazardId}/status`,
      headers: manager,
      payload: { status: "APPROVED" },
    });
    expect(doubleApproveRes.statusCode).toBe(400);

    // Transition APPROVED -> RESOLVED sets resolvedAt without awarding duplicate points
    const resolveRes = await ctx.app.inject({
      method: "PATCH",
      url: `/v1/manager/hazards/${hazardId}/status`,
      headers: manager,
      payload: { status: "RESOLVED" },
    });
    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.json().status).toBe("RESOLVED");
    expect(resolveRes.json().resolvedAt).not.toBeNull();

    // Verify Beatriz received exactly +25 EcoPoints
    const meAfterHazard = (
      await ctx.app.inject({ method: "GET", url: "/v1/me", headers: beatriz })
    ).json();
    expect(meAfterHazard.ecoPointsBalance).toBe(25);

    // 3. Beatriz submits a borderline speed WALK trip -> PENDING_REVIEW
    const tripRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers: beatriz,
      payload: {
        transportMode: "WALK",
        coordinates: [
          { latitude: -23.49, longitude: -47.454, recordedAt: "2026-10-21T10:00:00.000Z" },
          { latitude: -23.49, longitude: -47.449, recordedAt: "2026-10-21T10:03:10.000Z" },
          { latitude: -23.49, longitude: -47.444, recordedAt: "2026-10-21T10:06:20.000Z" },
        ],
      },
    });
    const pendingTrip = tripRes.json();
    expect(pendingTrip.status).toBe("PENDING_REVIEW");

    // MobilityManager lists PENDING_REVIEW trips and approves it
    const listPendingRes = await ctx.app.inject({
      method: "GET",
      url: "/v1/manager/trips?status=PENDING_REVIEW",
      headers: manager,
    });
    expect(listPendingRes.statusCode).toBe(200);
    expect(listPendingRes.json().trips).toHaveLength(1);

    const reviewTripRes = await ctx.app.inject({
      method: "PATCH",
      url: `/v1/manager/trips/${pendingTrip.id}/status`,
      headers: manager,
      payload: { status: "VALIDATED" },
    });
    expect(reviewTripRes.statusCode).toBe(200);
    expect(reviewTripRes.json().status).toBe("VALIDATED");
    expect(reviewTripRes.json().ecoPointsEarned).toBe(10);

    // Beatriz now has 25 + 10 = 35 EcoPoints
    const meFinal = (
      await ctx.app.inject({ method: "GET", url: "/v1/me", headers: beatriz })
    ).json();
    expect(meFinal.ecoPointsBalance).toBe(35);
  });
});
