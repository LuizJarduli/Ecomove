import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestContext, seedCampusZone, type TestContext } from "./helpers.js";

describe("Slice 3 — CarpoolSession (QR / 4-Digit Code) & Shared Trip Validation", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    await seedCampusZone(ctx.prisma);
  });

  afterEach(async () => {
    await ctx.close();
  });

  const validCarpoolCoordinates = [
    { latitude: -23.49, longitude: -47.454, recordedAt: "2026-10-21T10:00:00.000Z" },
    { latitude: -23.49, longitude: -47.449, recordedAt: "2026-10-21T10:01:30.000Z" },
    { latitude: -23.49, longitude: -47.444, recordedAt: "2026-10-21T10:03:00.000Z" },
  ];

  it("rejects solo CARPOOL trip submitted without a carpoolSessionId", async () => {
    const driverHeaders = ctx.bearer("motorista@facens.br");

    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers: driverHeaders,
      payload: {
        transportMode: "CARPOOL",
        coordinates: validCarpoolCoordinates,
      },
    });

    expect(res.statusCode).toBe(201);
    const trip = res.json();
    expect(trip.status).toBe("REJECTED");
    expect(trip.ecoPointsEarned).toBe(0);
    expect(trip.rejectionReason).toContain("CARPOOL_SESSION_REQUIRED");
  });

  it("prevents a driver from joining their own CarpoolSession and rejects solo session trips (< 2 participants)", async () => {
    const driverHeaders = ctx.bearer("motorista@facens.br");

    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/carpool-sessions",
      headers: driverHeaders,
    });
    expect(createRes.statusCode).toBe(201);
    const session = createRes.json();
    expect(session.joinCode).toHaveLength(4);
    expect(session.status).toBe("OPEN");
    expect(session.participants).toHaveLength(1);

    // Driver tries to join own session
    const selfJoinRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/carpool-sessions/join",
      headers: driverHeaders,
      payload: { joinCode: session.joinCode },
    });
    expect(selfJoinRes.statusCode).toBe(400);
    expect(selfJoinRes.json().error).toBe("DRIVER_CANNOT_SELF_JOIN");

    // Driver submits CARPOOL trip before any passenger joins -> REJECTED (< 2 participants)
    const soloTripRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers: driverHeaders,
      payload: {
        transportMode: "CARPOOL",
        carpoolSessionId: session.id,
        coordinates: validCarpoolCoordinates,
      },
    });
    expect(soloTripRes.statusCode).toBe(201);
    expect(soloTripRes.json().status).toBe("REJECTED");
    expect(soloTripRes.json().rejectionReason).toContain("CARPOOL_MIN_PARTICIPANTS");
  });

  it("pairs driver and passenger via joinCode, holds first arrival in PENDING_REVIEW, and validates & credits both on mutual CampusZone arrival", async () => {
    const driverHeaders = ctx.bearer("motorista@facens.br");
    const passengerHeaders = ctx.bearer("passageira@facens.br");

    // 1. Driver creates session
    const createRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/carpool-sessions",
      headers: driverHeaders,
    });
    const session = createRes.json();

    // 2. Passenger joins by 4-char joinCode
    const joinRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/carpool-sessions/join",
      headers: passengerHeaders,
      payload: { joinCode: session.joinCode },
    });
    expect(joinRes.statusCode).toBe(200);
    expect(joinRes.json().participants).toHaveLength(2);

    // 3. Driver submits trajectory intersecting CampusZone (~1.02 km -> 5 pts/km = 5 pts)
    // Held in PENDING_REVIEW until passenger also completes arrival
    const driverTripRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers: driverHeaders,
      payload: {
        transportMode: "CARPOOL",
        carpoolSessionId: session.id,
        coordinates: validCarpoolCoordinates,
      },
    });
    expect(driverTripRes.statusCode).toBe(201);
    const driverTripInitial = driverTripRes.json();
    expect(driverTripInitial.status).toBe("PENDING_REVIEW");
    expect(driverTripInitial.ecoPointsEarned).toBe(0);

    // 4. Passenger submits trajectory intersecting CampusZone -> both become VALIDATED and earn 5 EcoPoints + ~71.5g CO2
    const passengerTripRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers: passengerHeaders,
      payload: {
        transportMode: "CARPOOL",
        carpoolSessionId: session.id,
        coordinates: validCarpoolCoordinates,
      },
    });
    expect(passengerTripRes.statusCode).toBe(201);
    const passengerTrip = passengerTripRes.json();
    expect(passengerTrip.status).toBe("VALIDATED");
    expect(passengerTrip.ecoPointsEarned).toBe(5);
    expect(passengerTrip.co2SavedGrams).toBeGreaterThan(70);

    // Verify both driver and passenger balances and trip statuses are now VALIDATED with 5 EcoPoints
    const driverMe = (await ctx.app.inject({ method: "GET", url: "/v1/me", headers: driverHeaders })).json();
    const passengerMe = (await ctx.app.inject({ method: "GET", url: "/v1/me", headers: passengerHeaders })).json();
    expect(driverMe.ecoPointsBalance).toBe(5);
    expect(passengerMe.ecoPointsBalance).toBe(5);

    const driverTrips = (
      await ctx.app.inject({ method: "GET", url: "/v1/trips/me", headers: driverHeaders })
    ).json().trips;
    expect(driverTrips[0].status).toBe("VALIDATED");
    expect(driverTrips[0].ecoPointsEarned).toBe(5);
  });
});
