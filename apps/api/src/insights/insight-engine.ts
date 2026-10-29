import { z } from "zod";
import type { AnalyticsOverviewDto } from "../analytics/analytics-repository.js";

export const insightProviderSchema = z.enum(["GEMINI", "OLLAMA", "DETERMINISTIC"]);
export type InsightProviderDto = z.infer<typeof insightProviderSchema>;

export const mobilityInsightDtoSchema = z.object({
  id: z.string(),
  audience: z.enum(["MANAGER", "COMMUTER"]),
  provider: insightProviderSchema,
  summary: z.string(),
  priorityCorridors: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  createdAt: z.string(),
});
export type MobilityInsightDto = z.infer<typeof mobilityInsightDtoSchema>;

export interface AggregatedMobilitySnapshot {
  overview: AnalyticsOverviewDto;
  topHazards: Array<{
    category: string;
    description: string;
    endorsementCount: number;
  }>;
}

export interface CommuterMobilitySummary {
  commuterId: string;
  name: string | null;
  ecoPointsBalance: number;
  totalDistanceMeters: number;
  totalCo2SavedGrams: number;
  recentTripCount: number;
  affordableRewards: Array<{ title: string; costEcoPoints: number }>;
}

/** Pluggable AI InsightEngine Facade (ADR-0004). */
export interface InsightEngine {
  readonly providerName: InsightProviderDto;
  generateManagerInsight(input: AggregatedMobilitySnapshot): Promise<{
    summary: string;
    priorityCorridors: string[];
    recommendedActions: string[];
  }>;
  generateCommuterNudge(input: CommuterMobilitySummary): Promise<{
    summary: string;
    priorityCorridors: string[];
    recommendedActions: string[];
  }>;
}

const structuredOutputSchema = z.object({
  summary: z.string().min(5),
  priorityCorridors: z.array(z.string()),
  recommendedActions: z.array(z.string()),
});

export class DeterministicInsightEngine implements InsightEngine {
  readonly providerName: InsightProviderDto = "DETERMINISTIC";

  async generateManagerInsight(input: AggregatedMobilitySnapshot) {
    const { overview, topHazards } = input;
    const topHazard = topHazards[0];
    const peakHour = [...overview.hourlyDistribution].sort((a, b) => b.tripCount - a.tripCount)[0];

    const summary = topHazard
      ? `Foram registradas ${overview.totalValidatedTrips} viagens validadas (${overview.totalDistanceKm.toFixed(1)} km, ${overview.totalCo2SavedGrams.toFixed(0)}g de CO₂ evitados). O ponto crítico prioritário é "${topHazard.description}" (${topHazard.category}) com ${topHazard.endorsementCount} confirmações da comunidade.`
      : `Foram registradas ${overview.totalValidatedTrips} viagens validadas (${overview.totalDistanceKm.toFixed(1)} km) e ${overview.totalCo2SavedGrams.toFixed(0)}g de CO₂ evitados no perímetro da CampusZone FACENS.`;

    const priorityCorridors = [
      "Corredor Oeste — Rod. Senador José Ermírio de Moraes (Acesso Principal FACENS)",
      peakHour && peakHour.tripCount > 0
        ? `Janela de Pico das ${String(peakHour.hour).padStart(2, "0")}h00 (${peakHour.tripCount} viagens)`
        : "Anel Cicloviário Interno — Blocos B, C e E",
    ];

    const recommendedActions = [
      topHazard
        ? `Priorizar manutenção em "${topHazard.description}" (${topHazard.endorsementCount} endossos em raio de 30m).`
        : "Manter monitoramento preventivo de calçadas e ciclovias na CampusZone.",
      "Reforçar iluminação LED e sinalização horizontal nos horários de troca de turno.",
    ];

    return { summary, priorityCorridors, recommendedActions };
  }

  async generateCommuterNudge(input: CommuterMobilitySummary) {
    const firstName = input.name?.split(" ")[0] ?? "Estudante";
    const km = (input.totalDistanceMeters / 1000).toFixed(1);
    const nextReward = input.affordableRewards[0];

    const summary = nextReward
      ? `Parabéns, ${firstName}! Você já evitou ${input.totalCo2SavedGrams.toFixed(0)}g de CO₂ em ${km} km sustentáveis e possui ${input.ecoPointsBalance} EcoPoints — saldo suficiente para resgatar "${nextReward.title}" (${nextReward.costEcoPoints} pts)!`
      : `Continue firme, ${firstName}! Você acumula ${input.ecoPointsBalance} EcoPoints e ${input.totalCo2SavedGrams.toFixed(0)}g de CO₂ evitados em ${km} km pela CampusZone FACENS.`;

    return {
      summary,
      priorityCorridors: ["Ciclovia Campus FACENS · Portaria Principal"],
      recommendedActions: [
        "Registre seu próximo deslocamento a pé, de bicicleta ou carona solidária (até 100 EcoPoints/dia).",
      ],
    };
  }
}

export class GeminiInsightEngine implements InsightEngine {
  readonly providerName: InsightProviderDto = "GEMINI";
  private readonly fallback = new DeterministicInsightEngine();

  constructor(
    private readonly options: {
      apiKey?: string;
      model?: string;
      fetchImpl?: typeof fetch;
    } = {},
  ) {}

  async generateManagerInsight(input: AggregatedMobilitySnapshot) {
    const apiKey = this.options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return this.fallback.generateManagerInsight(input);
    }

    const model = this.options.model ?? "gemini-2.5-flash";
    const fetchFn = this.options.fetchImpl ?? fetch;
    const prompt = `Gere um diagnóstico executivo em português (pt-BR) em formato JSON com as chaves "summary", "priorityCorridors" (array de strings) e "recommendedActions" (array de strings) para os dados de mobilidade FACENS: ${JSON.stringify(input)}`;

    const response = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );

    if (!response.ok) {
      return this.fallback.generateManagerInsight(input);
    }

    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return this.fallback.generateManagerInsight(input);
    }
    return structuredOutputSchema.parse(JSON.parse(rawText));
  }

  async generateCommuterNudge(input: CommuterMobilitySummary) {
    const apiKey = this.options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return this.fallback.generateCommuterNudge(input);
    }

    const model = this.options.model ?? "gemini-2.5-flash";
    const fetchFn = this.options.fetchImpl ?? fetch;
    const prompt = `Gere uma mensagem motivacional curta em português (pt-BR) em JSON com "summary", "priorityCorridors" e "recommendedActions" para o usuário: ${JSON.stringify(input)}`;

    const response = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );

    if (!response.ok) {
      return this.fallback.generateCommuterNudge(input);
    }

    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return this.fallback.generateCommuterNudge(input);
    }
    return structuredOutputSchema.parse(JSON.parse(rawText));
  }
}

export class OllamaInsightEngine implements InsightEngine {
  readonly providerName: InsightProviderDto = "OLLAMA";
  private readonly fallback = new DeterministicInsightEngine();

  constructor(
    private readonly options: {
      baseUrl?: string;
      model?: string;
      fetchImpl?: typeof fetch;
    } = {},
  ) {}

  async generateManagerInsight(input: AggregatedMobilitySnapshot) {
    const baseUrl = this.options.baseUrl ?? process.env.OLLAMA_BASE_URL;
    if (!baseUrl) {
      return this.fallback.generateManagerInsight(input);
    }

    const model = this.options.model ?? process.env.OLLAMA_MODEL ?? "llama3.2";
    const fetchFn = this.options.fetchImpl ?? fetch;
    try {
      const response = await fetchFn(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          format: "json",
          stream: false,
          prompt: `Retorne JSON com summary, priorityCorridors e recommendedActions em pt-BR: ${JSON.stringify(input)}`,
        }),
      });
      if (!response.ok) return this.fallback.generateManagerInsight(input);
      const data = (await response.json()) as { response?: string };
      if (!data.response) return this.fallback.generateManagerInsight(input);
      return structuredOutputSchema.parse(JSON.parse(data.response));
    } catch {
      return this.fallback.generateManagerInsight(input);
    }
  }

  async generateCommuterNudge(input: CommuterMobilitySummary) {
    const baseUrl = this.options.baseUrl ?? process.env.OLLAMA_BASE_URL;
    if (!baseUrl) {
      return this.fallback.generateCommuterNudge(input);
    }

    const model = this.options.model ?? process.env.OLLAMA_MODEL ?? "llama3.2";
    const fetchFn = this.options.fetchImpl ?? fetch;
    try {
      const response = await fetchFn(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          format: "json",
          stream: false,
          prompt: `Retorne JSON com summary, priorityCorridors e recommendedActions em pt-BR: ${JSON.stringify(input)}`,
        }),
      });
      if (!response.ok) return this.fallback.generateCommuterNudge(input);
      const data = (await response.json()) as { response?: string };
      if (!data.response) return this.fallback.generateCommuterNudge(input);
      return structuredOutputSchema.parse(JSON.parse(data.response));
    } catch {
      return this.fallback.generateCommuterNudge(input);
    }
  }
}

export function resolveInsightEngine(provider?: InsightProviderDto): InsightEngine {
  const chosen =
    provider ??
    ((process.env.INSIGHT_PROVIDER?.toUpperCase() as InsightProviderDto | undefined) ??
      "DETERMINISTIC");

  switch (chosen) {
    case "GEMINI":
      return new GeminiInsightEngine();
    case "OLLAMA":
      return new OllamaInsightEngine();
    default:
      return new DeterministicInsightEngine();
  }
}
