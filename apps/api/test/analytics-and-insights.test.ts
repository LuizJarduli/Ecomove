import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiInsightEngine, OllamaInsightEngine } from "../src/insights/insight-engine.js";
import { createTestContext, seedCampusZone, type TestContext } from "./helpers.js";

describe("Slices 7 & 8 — BI Analytics, PostGIS Spatial Heatmap & Pluggable AI InsightEngine", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
    await seedCampusZone(ctx.prisma);
    await ctx.prisma.mobilityManager.create({
      data: {
        email: "ricardo@facens.br",
        name: "Ricardo Fontoura",
        department: "Planejamento Urbano",
      },
    });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it("computes modal split, institutional filter, PostGIS spatial heatmap, and generates Manager & Commuter MobilityInsights", async () => {
    const manager = ctx.bearer("ricardo@facens.br");
    const institutionalCommuter = ctx.bearer("beatriz@facens.br");
    const externalCommuter = ctx.bearer("visitante@gmail.com");

    // 1. Institutional commuter records a valid BICYCLE trip (~1km) and a HazardReport
    await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers: institutionalCommuter,
      payload: {
        transportMode: "BICYCLE",
        coordinates: [
          { latitude: -23.49, longitude: -47.454, recordedAt: "2026-10-21T11:00:00.000Z" },
          { latitude: -23.49, longitude: -47.449, recordedAt: "2026-10-21T11:02:00.000Z" },
          { latitude: -23.49, longitude: -47.444, recordedAt: "2026-10-21T11:04:00.000Z" },
        ],
      },
    });

    await ctx.app.inject({
      method: "POST",
      url: "/v1/hazards",
      headers: institutionalCommuter,
      payload: {
        category: "BIKE_LANE_OBSTRUCTION",
        description: "Galho caído na ciclovia do Bloco C",
        latitude: -23.49,
        longitude: -47.45,
      },
    });

    // 2. External commuter records a valid WALK trip (~500m)
    await ctx.app.inject({
      method: "POST",
      url: "/v1/trips",
      headers: externalCommuter,
      payload: {
        transportMode: "WALK",
        coordinates: [
          { latitude: -23.49, longitude: -47.454, recordedAt: "2026-10-21T12:00:00.000Z" },
          { latitude: -23.49, longitude: -47.449, recordedAt: "2026-10-21T12:05:00.000Z" },
        ],
      },
    });

    // 3. Manager queries overview (all vs institutionalOnly=true)
    const allOverviewRes = await ctx.app.inject({
      method: "GET",
      url: "/v1/manager/analytics/overview",
      headers: manager,
    });
    expect(allOverviewRes.statusCode).toBe(200);
    const allOverview = allOverviewRes.json();
    expect(allOverview.totalCommuters).toBe(2);
    expect(allOverview.institutionalCommuters).toBe(1);
    expect(allOverview.externalCommuters).toBe(1);
    expect(allOverview.totalValidatedTrips).toBe(2);
    expect(allOverview.hourlyDistribution).toHaveLength(24);

    const instOverviewRes = await ctx.app.inject({
      method: "GET",
      url: "/v1/manager/analytics/overview?institutionalOnly=true",
      headers: manager,
    });
    expect(instOverviewRes.statusCode).toBe(200);
    const instOverview = instOverviewRes.json();
    expect(instOverview.totalCommuters).toBe(1);
    expect(instOverview.totalValidatedTrips).toBe(1);
    expect(instOverview.modalSplit[0].transportMode).toBe("BICYCLE");

    // 4. Manager queries PostGIS spatial heatmap
    const heatmapRes = await ctx.app.inject({
      method: "GET",
      url: "/v1/manager/analytics/spatial-heatmap",
      headers: manager,
    });
    expect(heatmapRes.statusCode).toBe(200);
    const heatmap = heatmapRes.json();
    expect(heatmap.tripCorridors).toHaveLength(2);
    expect(heatmap.tripCorridors[0].route.type).toBe("LineString");
    expect(heatmap.hazardClusters).toHaveLength(1);
    expect(heatmap.hazardClusters[0].category).toBe("BIKE_LANE_OBSTRUCTION");

    // 5. Manager triggers AI InsightEngine (DETERMINISTIC provider)
    const managerInsightRes = await ctx.app.inject({
      method: "POST",
      url: "/v1/manager/analytics/insights",
      headers: manager,
      payload: { provider: "DETERMINISTIC", institutionalOnly: false },
    });
    expect(managerInsightRes.statusCode).toBe(201);
    const managerInsight = managerInsightRes.json();
    expect(managerInsight.audience).toBe("MANAGER");
    expect(managerInsight.provider).toBe("DETERMINISTIC");
    expect(managerInsight.summary).toContain("Galho caído na ciclovia do Bloco C");
    expect(managerInsight.priorityCorridors.length).toBeGreaterThan(0);

    // 6. Commuter requests personalized AI Nudge
    const nudgeRes = await ctx.app.inject({
      method: "GET",
      url: "/v1/commuters/me/nudge",
      headers: institutionalCommuter,
    });
    expect(nudgeRes.statusCode).toBe(200);
    const nudge = nudgeRes.json();
    expect(nudge.audience).toBe("COMMUTER");
    expect(nudge.summary).toContain("EcoPoints");
  });

  it("verifies GeminiInsightEngine and OllamaInsightEngine contract parsing with mocked fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "Diagnóstico Gemini: Corredor cicloviário oeste com alta demanda.",
                    priorityCorridors: ["Portaria Principal FACENS"],
                    recommendedActions: ["Instalar bicicletário coberto no Bloco E"],
                  }),
                },
              ],
            },
          },
        ],
        response: JSON.stringify({
          summary: "Diagnóstico Ollama Local: Reduzir conflito calçada-ciclovia.",
          priorityCorridors: ["Acesso Bloco C"],
          recommendedActions: ["Reparo de calçada a 20m da rotatória"],
        }),
      }),
    });

    const gemini = new GeminiInsightEngine({
      apiKey: "test-gemini-key",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    const ollama = new OllamaInsightEngine({
      baseUrl: "http://localhost:11434",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const sampleSnapshot = {
      overview: {
        totalCommuters: 10,
        institutionalCommuters: 8,
        externalCommuters: 2,
        totalValidatedTrips: 25,
        totalDistanceKm: 42.5,
        totalCo2SavedGrams: 5100,
        modalSplit: [],
        hourlyDistribution: [],
        hazardSummary: [],
      },
      topHazards: [],
    };

    const geminiOut = await gemini.generateManagerInsight(sampleSnapshot);
    expect(geminiOut.summary).toContain("Diagnóstico Gemini");
    expect(geminiOut.priorityCorridors).toEqual(["Portaria Principal FACENS"]);

    const ollamaOut = await ollama.generateManagerInsight(sampleSnapshot);
    expect(ollamaOut.summary).toContain("Diagnóstico Ollama Local");
    expect(ollamaOut.recommendedActions).toEqual(["Reparo de calçada a 20m da rotatória"]);
  });
});
