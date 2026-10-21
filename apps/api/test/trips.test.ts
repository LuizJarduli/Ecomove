import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestContext, seedCampusZone, type TestContext } from "./helpers.js";

describe("Slice 2 — POST /v1/trips, GET /v1/trips/me & GET /v1/ledger/me", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    await seedCampusZone(ctx.prisma);
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("validates a clean WALK trip intersecting CampusZone, calculates CO2 and credits EcoPoints in ledger", async () => {
    const headers = ctx.bearer("beatriz@facens.br");

    // ~1.02 km walk inside CampusZone over 600s (~6.13 km/h)
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers,
      payload: {
        transportMode: "WALK",
        coordinates: [
          { latitude: -23.49, longitude: -47.454, recordedAt: "2026-10-21T10:00:00.000Z" },
          { latitude: -23.49, longitude: -47.449, recordedAt: "2026-10-21T10:05:00.000Z" },
          { latitude: -23.49, longitude: -47.444, recordedAt: "2026-10-21T10:10:00.000Z" },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const trip = response.json();
    expect(trip.status).toBe("VALIDATED");
    expect(trip.transportMode).toBe("WALK");
    expect(trip.distanceMeters).toBeGreaterThan(1000);
    expect(trip.distanceMeters).toBeLessThan(1050);
    expect(trip.ecoPointsEarned).toBe(10);
    expect(trip.co2SavedGrams).toBeGreaterThan(140);
    expect(trip.rejectionReason).toBeNull();
    expect(trip.route.type).toBe("LineString");
    expect(trip.route.coordinates).toHaveLength(3);

    // Verify GET /v1/me reflects updated balance and totals
    const meRes = await ctx.app.inject({
      method: "GET",
      url: "/v1/me",
      headers,
    });
    expect(meRes.statusCode).toBe(200);
    const me = meRes.json();
    expect(me.ecoPointsBalance).toBe(10);
    expect(me.totalDistanceMeters).toBeCloseTo(trip.distanceMeters, 1);
    expect(me.totalCo2SavedGrams).toBeCloseTo(trip.co2SavedGrams, 1);

    // Verify GET /v1/ledger/me has an immutable TRIP_VALIDATED PointTransaction
    const ledgerRes = await ctx.app.inject({
      method: "GET",
      url: "/v1/ledger/me",
      headers,
    });
    expect(ledgerRes.statusCode).toBe(200);
    const { transactions } = ledgerRes.json();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].amount).toBe(10);
    expect(transactions[0].reason).toBe("TRIP_VALIDATED");
    expect(transactions[0].tripId).toBe(trip.id);

    // Verify GET /v1/trips/me lists the trip
    const tripsRes = await ctx.app.inject({
      method: "GET",
      url: "/v1/trips/me",
      headers,
    });
    expect(tripsRes.statusCode).toBe(200);
    const { trips } = tripsRes.json();
    expect(trips).toHaveLength(1);
    expect(trips[0].id).toBe(trip.id);
  });

  it("rejects a trip that does not intersect the active CampusZone", async () => {
    const headers = ctx.bearer("beatriz@facens.br");

    // Trajectory far south of CampusZone (-23.55 vs -23.49)
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers,
      payload: {
        transportMode: "WALK",
        coordinates: [
          { latitude: -23.55, longitude: -47.454, recordedAt: "2026-10-21T10:00:00.000Z" },
          { latitude: -23.55, longitude: -47.444, recordedAt: "2026-10-21T10:10:00.000Z" },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const trip = response.json();
    expect(trip.status).toBe("REJECTED");
    expect(trip.ecoPointsEarned).toBe(0);
    expect(trip.co2SavedGrams).toBe(0);
    expect(trip.rejectionReason).toContain("OUTSIDE_CAMPUS_ZONE");
  });

  it("rejects a trip shorter than 300 meters", async () => {
    const headers = ctx.bearer("beatriz@facens.br");

    // ~102m displacement inside CampusZone
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers,
      payload: {
        transportMode: "WALK",
        coordinates: [
          { latitude: -23.49, longitude: -47.45, recordedAt: "2026-10-21T10:00:00.000Z" },
          { latitude: -23.49, longitude: -47.449, recordedAt: "2026-10-21T10:02:00.000Z" },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const trip = response.json();
    expect(trip.status).toBe("REJECTED");
    expect(trip.distanceMeters).toBeLessThan(300);
    expect(trip.ecoPointsEarned).toBe(0);
    expect(trip.rejectionReason).toContain("MIN_DISTANCE_NOT_MET");
  });

  it("rejects a WALK trip exceeding hardReject speed thresholds", async () => {
    const headers = ctx.bearer("beatriz@facens.br");

    // ~1.02 km in 60 seconds (~61 km/h declared as WALK)
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers,
      payload: {
        transportMode: "WALK",
        coordinates: [
          { latitude: -23.49, longitude: -47.454, recordedAt: "2026-10-21T10:00:00.000Z" },
          { latitude: -23.49, longitude: -47.444, recordedAt: "2026-10-21T10:01:00.000Z" },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const trip = response.json();
    expect(trip.status).toBe("REJECTED");
    expect(trip.ecoPointsEarned).toBe(0);
    expect(trip.rejectionReason).toContain("SPEED_LIMIT_EXCEEDED");
  });

  it("marks a borderline speed trip as PENDING_REVIEW with 0 initial EcoPoints", async () => {
    const headers = ctx.bearer("beatriz@facens.br");

    // ~1.02 km in 380 seconds (~9.67 km/h: between maxCleanAvg 8 and hardRejectAvg 12 for WALK)
    const response = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers,
      payload: {
        transportMode: "WALK",
        coordinates: [
          { latitude: -23.49, longitude: -47.454, recordedAt: "2026-10-21T10:00:00.000Z" },
          { latitude: -23.49, longitude: -47.449, recordedAt: "2026-10-21T10:03:10.000Z" },
          { latitude: -23.49, longitude: -47.444, recordedAt: "2026-10-21T10:06:20.000Z" },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const trip = response.json();
    expect(trip.status).toBe("PENDING_REVIEW");
    expect(trip.ecoPointsEarned).toBe(0);
    expect(trip.rejectionReason).toBeNull();
  });

  it("enforces the 100 EcoPoints/day cap while still validating subsequent trips and recording CO2", async () => {
    const headers = ctx.bearer("ciclista@facens.br");

    // ~8.58 km BICYCLE ride ending inside CampusZone over 1800s (~17.1 km/h -> ~69 EcoPoints at 8 pts/km)
    const bikePayload = (startHour: string, midHour: string, endHour: string) => ({
      transportMode: "BICYCLE",
      coordinates: [
        { latitude: -23.49, longitude: -47.53, recordedAt: `2026-10-21T${startHour}:00.000Z` },
        { latitude: -23.49, longitude: -47.488, recordedAt: `2026-10-21T${midHour}:00.000Z` },
        { latitude: -23.49, longitude: -47.446, recordedAt: `2026-10-21T${endHour}:00.000Z` },
      ],
    });

    const firstRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers,
      payload: bikePayload("08:00", "08:15", "08:30"),
    });
    expect(firstRes.statusCode).toBe(201);
    const firstTrip = firstRes.json();
    expect(firstTrip.status).toBe("VALIDATED");
    expect(firstTrip.ecoPointsEarned).toBe(69);

    // Second ride on same day should be clamped to remaining 31 points (100 - 69 = 31)
    const secondRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers,
      payload: bikePayload("12:00", "12:15", "12:30"),
    });
    expect(secondRes.statusCode).toBe(201);
    const secondTrip = secondRes.json();
    expect(secondTrip.status).toBe("VALIDATED");
    expect(secondTrip.ecoPointsEarned).toBe(31);
    expect(secondTrip.co2SavedGrams).toBeGreaterThan(1000);

    // Third ride on same day is VALIDATED with CO2 saved, but 0 EcoPoints
    const thirdRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers,
      payload: bikePayload("17:00", "17:15", "17:30"),
    });
    expect(thirdRes.statusCode).toBe(201);
    const thirdTrip = thirdRes.json();
    expect(thirdTrip.status).toBe("VALIDATED");
    expect(thirdTrip.ecoPointsEarned).toBe(0);
    expect(thirdTrip.co2SavedGrams).toBeGreaterThan(1000);

    // Balance is capped at 100
    const meRes = await ctx.app.inject({
      method: "GET",
      url: "/v1/me",
      headers,
    });
    expect(meRes.json().ecoPointsBalance).toBe(100);
  });
});
