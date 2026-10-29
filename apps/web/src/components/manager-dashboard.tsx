"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createRewardCatalogAction,
  generateInsightAction,
  moderateHazardAction,
  moderateTripAction,
  sweepExpiredVouchersAction,
} from "@/actions/manager";
import { CampusZoneMapLoader } from "@/components/campus-zone-map-loader";
import type {
  AnalyticsOverview,
  CampusZone,
  HazardCategory,
  HazardReportItem,
  InsightProvider,
  MobilityInsightItem,
  RewardItem,
  SpatialHeatmap,
  TransportMode,
  TripItem,
} from "@/lib/api";

const TRANSPORT_LABELS_PT: Record<TransportMode, string> = {
  WALK: "Caminhada (10 pts/km)",
  BICYCLE: "Bicicleta (8 pts/km)",
  CARPOOL: "Carona Solidária (5 pts/km)",
  PUBLIC_TRANSIT: "Transporte Público (4 pts/km)",
};

const HAZARD_LABELS_PT: Record<HazardCategory, string> = {
  SIDEWALK_DAMAGE: "Calçada Danificada",
  BIKE_LANE_OBSTRUCTION: "Ciclovia Obstruída",
  POOR_LIGHTING: "Iluminação Precária",
  BUS_STOP_ISSUE: "Ponto de Ônibus",
  OTHER: "Outros",
};

interface ManagerDashboardProps {
  zone: CampusZone | null;
  overview: AnalyticsOverview;
  heatmap: SpatialHeatmap;
  hazards: HazardReportItem[];
  pendingTrips: TripItem[];
  rewards: RewardItem[];
  insights: MobilityInsightItem[];
  institutionalOnly: boolean;
}

export function ManagerDashboard({
  zone,
  overview,
  heatmap,
  hazards,
  pendingTrips,
  rewards,
  insights: initialInsights,
  institutionalOnly,
}: ManagerDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"bi" | "moderation" | "catalog" | "insights">("bi");
  const [selectedProvider, setSelectedProvider] = useState<InsightProvider>("DETERMINISTIC");
  const [insights, setInsights] = useState<MobilityInsightItem[]>(initialInsights);
  const [sweepResult, setSweepResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const maxHourlyCount = Math.max(1, ...overview.hourlyDistribution.map((h) => h.tripCount));

  return (
    <div className="space-y-8">
      {/* Header & Institutional Filter */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E7E7E4] pb-6">
        <div>
          <span className="label-caps text-emerald-800">
            Centro de Operações · PostGIS SRID 4326 · Ledger Imutável
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {zone?.name ?? "Campus FACENS — Sorocaba"}
          </h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Monitoramento geoespacial, fila de moderação de zeladoria, catálogo de parceiros e
            diagnósticos via <code className="font-mono text-xs">InsightEngine</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const next = !institutionalOnly;
              router.push(`/painel?institutionalOnly=${next ? "true" : "false"}`);
            }}
            className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
              institutionalOnly
                ? "border-emerald-700 bg-emerald-950 text-white"
                : "border-[#E7E7E4] bg-[#FCFCFB] text-[#111111] hover:bg-[#E5E2E1]"
            }`}
          >
            {institutionalOnly
              ? "Filtro Ativo: Apenas @facens.br"
              : "Exibindo: Comunidade Completa (@facens.br + Externos)"}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#E7E7E4] bg-[#FCFCFB] p-1.5">
        {[
          { id: "bi", label: "1. Visão Geral BI & Mapa PostGIS" },
          {
            id: "moderation",
            label: `2. Validação de Ocorrências & Trajetos (${
              hazards.filter((h) => h.status === "PENDING").length + pendingTrips.length
            })`,
          },
          { id: "catalog", label: `3. Parceiros & Recompensas (${rewards.length})` },
          { id: "insights", label: "4. Análise Inteligente (IA Facade)" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`rounded-xl px-4 py-2.5 text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[#111111] text-white shadow-sm"
                : "text-[#6B6B6B] hover:text-[#111111]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: BI & POSTGIS HEATMAP */}
      {activeTab === "bi" && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[20px] border border-[#E7E7E4] bg-[#FCFCFB] p-5">
              <span className="label-caps text-[#6B6B6B]">Viagens Validadas</span>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {overview.totalValidatedTrips}
              </p>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Intersecção confirmada via <code className="font-mono">ST_Intersects</code>
              </p>
            </div>
            <div className="rounded-[20px] border border-[#E7E7E4] bg-[#FCFCFB] p-5">
              <span className="label-caps text-[#6B6B6B]">Distância Sustentável</span>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {overview.totalDistanceKm.toFixed(2)} km
              </p>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Calculada via <code className="font-mono">ST_Length(geography)</code>
              </p>
            </div>
            <div className="rounded-[20px] border border-[#E7E7E4] bg-[#FCFCFB] p-5">
              <span className="label-caps text-emerald-800">Emissões Evitadas (CO₂)</span>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-800">
                {(overview.totalCo2SavedGrams / 1000).toFixed(2)} kg
              </p>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                {overview.totalCo2SavedGrams.toFixed(0)}g acumulados no período
              </p>
            </div>
            <div className="rounded-[20px] border border-[#E7E7E4] bg-[#FCFCFB] p-5">
              <span className="label-caps text-[#6B6B6B]">Comunidade Ativa</span>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {overview.totalCommuters}
              </p>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                {overview.institutionalCommuters} @facens.br · {overview.externalCommuters} externos
              </p>
            </div>
          </div>

          {/* PostGIS Spatial Heatmap & Corridors */}
          {zone && (
            <div className="space-y-3 rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">
                    Mapa Espacial PostGIS · Corredores de Viagem & Clusters de Zeladoria
                  </h2>
                  <p className="text-xs text-[#6B6B6B]">
                    Polígono oficial da CampusZone, trajetos validados (verde/azul) e ocorrências
                    ponderadas por endossos em raio de 30m.
                  </p>
                </div>
                <span className="label-caps rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">
                  {heatmap.tripCorridors.length} Corredores · {heatmap.hazardClusters.length} Clusters
                </span>
              </div>
              <CampusZoneMapLoader zone={zone} heatmap={heatmap} />
            </div>
          )}

          {/* Modal Split & Hourly Distribution */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6">
              <h3 className="text-base font-semibold">Divisão Modal Sustentável</h3>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Participação por modal validado e impacto ambiental correspondente.
              </p>
              <div className="mt-4 space-y-3">
                {overview.modalSplit.length === 0 ? (
                  <p className="text-xs text-[#6B6B6B]">
                    Nenhuma viagem validada para o filtro selecionado.
                  </p>
                ) : (
                  overview.modalSplit.map((item) => (
                    <div
                      key={item.transportMode}
                      className="flex items-center justify-between rounded-xl border border-[#E7E7E4] bg-[#F7F7F5] px-4 py-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#111111]">
                          {TRANSPORT_LABELS_PT[item.transportMode]}
                        </p>
                        <p className="text-[#6B6B6B]">{item.tripCount} viagens registradas</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold">{item.distanceKm.toFixed(2)} km</p>
                        <p className="text-emerald-800">{item.co2SavedGrams.toFixed(0)}g CO₂</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6">
              <h3 className="text-base font-semibold">Distribuição Horária de Fluxo (0h–23h)</h3>
              <p className="mt-1 text-xs text-[#6B6B6B]">
                Volume de chegadas e saídas sustentáveis por faixa horária no campus.
              </p>
              <div className="mt-5 flex h-40 items-end gap-1.5 border-b border-[#E7E7E4] pb-2">
                {overview.hourlyDistribution.map((bucket) => {
                  const heightPct = Math.max(6, Math.round((bucket.tripCount / maxHourlyCount) * 100));
                  return (
                    <div
                      key={bucket.hour}
                      className="flex flex-1 flex-col items-center gap-1"
                      title={`${bucket.hour}h: ${bucket.tripCount} viagens`}
                    >
                      <div
                        className={`w-full rounded-t ${
                          bucket.tripCount > 0 ? "bg-emerald-600" : "bg-[#E7E7E4]"
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                      {bucket.hour % 3 === 0 && (
                        <span className="font-mono text-[9px] text-[#6B6B6B]">{bucket.hour}h</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MODERATION QUEUES (HAZARDS & PENDING_REVIEW TRIPS) */}
      {activeTab === "moderation" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* HazardReport Moderation Queue */}
          <div className="space-y-4 rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6">
            <div>
              <span className="label-caps text-amber-800">Zeladoria Urbana · Raio 30m ST_DWithin</span>
              <h2 className="mt-1 text-lg font-semibold">
                Fila de Validação de Ocorrências ({hazards.length})
              </h2>
              <p className="text-xs text-[#6B6B6B]">
                Aprovar uma ocorrência pendente credita automaticamente{" "}
                <strong className="text-[#111111]">+25 EcoPoints</strong> no ledger do autor.
              </p>
            </div>

            <div className="space-y-3">
              {hazards.length === 0 ? (
                <p className="text-xs text-[#6B6B6B]">Nenhuma ocorrência registrada até o momento.</p>
              ) : (
                hazards.map((hazard) => (
                  <div
                    key={hazard.id}
                    className="space-y-3 rounded-2xl border border-[#E7E7E4] bg-[#F7F7F5] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="label-caps text-emerald-900">
                          {HAZARD_LABELS_PT[hazard.category]} · {hazard.endorsementCount} endosso(s)
                        </span>
                        <p className="mt-1 text-sm font-semibold">{hazard.description}</p>
                        <p className="font-mono text-[11px] text-[#6B6B6B]">
                          Coords: {hazard.location.coordinates[1].toFixed(4)},{" "}
                          {hazard.location.coordinates[0].toFixed(4)}
                        </p>
                      </div>
                      <span className="label-caps rounded bg-white px-2.5 py-1 text-[10px] text-[#111111]">
                        {hazard.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {hazard.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              startTransition(() => moderateHazardAction(hazard.id, "APPROVED"))
                            }
                            className="rounded-full bg-emerald-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                          >
                            Aprovar (+25 EcoPoints)
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              startTransition(() => moderateHazardAction(hazard.id, "REJECTED"))
                            }
                            className="rounded-full border border-[#E7E7E4] bg-white px-3.5 py-1.5 text-xs font-medium text-[#93000A]"
                          >
                            Rejeitar
                          </button>
                        </>
                      )}
                      {hazard.status === "APPROVED" && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(() => moderateHazardAction(hazard.id, "RESOLVED"))
                          }
                          className="rounded-full bg-[#111111] px-3.5 py-1.5 text-xs font-medium text-white"
                        >
                          Marcar como Resolvida
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Borderline Trip Review Queue */}
          <div className="space-y-4 rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6">
            <div>
              <span className="label-caps text-amber-800">Auditoria Antifraude de Velocidade</span>
              <h2 className="mt-1 text-lg font-semibold">
                Trajetos Limítrofes em Revisão ({pendingTrips.length})
              </h2>
              <p className="text-xs text-[#6B6B6B]">
                Deslocamentos com velocidade na faixa de revisão manual (
                <code className="font-mono">PENDING_REVIEW</code>).
              </p>
            </div>

            <div className="space-y-3">
              {pendingTrips.length === 0 ? (
                <p className="text-xs text-[#6B6B6B]">
                  Nenhum trajeto pendente de revisão manual no momento.
                </p>
              ) : (
                pendingTrips.map((trip) => (
                  <div
                    key={trip.id}
                    className="space-y-3 rounded-2xl border border-[#E7E7E4] bg-[#F7F7F5] p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="label-caps text-[#111111]">
                          {TRANSPORT_LABELS_PT[trip.transportMode]}
                        </span>
                        <p className="mt-1 font-mono text-xs text-[#6B6B6B]">
                          {(trip.distanceMeters / 1000).toFixed(2)} km · Vel. Média:{" "}
                          {trip.averageSpeedKmh.toFixed(1)} km/h · Pico: {trip.maxSpeedKmh.toFixed(1)}{" "}
                          km/h
                        </p>
                      </div>
                      <span className="label-caps rounded bg-amber-100 px-2.5 py-1 text-amber-900">
                        PENDING_REVIEW
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(() => moderateTripAction(trip.id, "VALIDATED"))
                        }
                        className="rounded-full bg-emerald-700 px-3.5 py-1.5 text-xs font-medium text-white"
                      >
                        Validar e Creditar EcoPoints
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(() =>
                            moderateTripAction(
                              trip.id,
                              "REJECTED",
                              "Rejeitado na auditoria manual de velocidade.",
                            ),
                          )
                        }
                        className="rounded-full border border-[#E7E7E4] bg-white px-3.5 py-1.5 text-xs font-medium text-[#93000A]"
                      >
                        Rejeitar Trajeto
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PARTNER & REWARD CATALOG + 7-DAY SWEEP */}
      {activeTab === "catalog" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6 lg:col-span-5">
            <span className="label-caps text-emerald-800">Economia Circular · ADR-0003</span>
            <h2 className="text-lg font-semibold">Cadastrar Parceiro e Recompensa</h2>
            <form action={createRewardCatalogAction} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#111111]">Nome do Parceiro</label>
                <input
                  name="partnerName"
                  required
                  placeholder="Ex.: Cantina Central FACENS"
                  className="mt-1 w-full rounded-xl border border-[#E7E7E4] bg-white px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#111111]">Categoria</label>
                  <input
                    name="partnerCategory"
                    required
                    placeholder="Alimentação / Papelaria"
                    className="mt-1 w-full rounded-xl border border-[#E7E7E4] bg-white px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#111111]">Localização</label>
                  <input
                    name="partnerAddress"
                    placeholder="Bloco A — Térreo"
                    className="mt-1 w-full rounded-xl border border-[#E7E7E4] bg-white px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-[#111111]">Título da Recompensa</label>
                <input
                  name="title"
                  required
                  placeholder="Ex.: Café Expresso + Pão de Queijo"
                  className="mt-1 w-full rounded-xl border border-[#E7E7E4] bg-white px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium text-[#111111]">Descrição</label>
                <input
                  name="description"
                  required
                  placeholder="Válido mediante apresentação do voucher de 8 caracteres"
                  className="mt-1 w-full rounded-xl border border-[#E7E7E4] bg-white px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#111111]">Custo (EcoPoints)</label>
                  <input
                    name="costEcoPoints"
                    type="number"
                    min={1}
                    defaultValue={25}
                    required
                    className="mt-1 w-full rounded-xl border border-[#E7E7E4] bg-white px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#111111]">Estoque Inicial</label>
                  <input
                    name="stock"
                    type="number"
                    min={1}
                    defaultValue={20}
                    required
                    className="mt-1 w-full rounded-xl border border-[#E7E7E4] bg-white px-3 py-2"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-[#111111] py-2.5 text-xs font-medium text-white hover:bg-emerald-900"
              >
                Publicar Recompensa no Catálogo
              </button>
            </form>

            <div className="border-t border-[#E7E7E4] pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Varredura de Vouchers Expirados (7 Dias)</p>
                  <p className="text-[11px] text-[#6B6B6B]">
                    Estorna automaticamente EcoPoints e restaura o estoque.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await sweepExpiredVouchersAction();
                      setSweepResult(`${res.refundedCount} voucher(s) expirado(s) estornado(s).`);
                    })
                  }
                  className="rounded-full border border-[#E7E7E4] bg-white px-3.5 py-1.5 text-xs font-medium text-[#111111]"
                >
                  Executar Varredura
                </button>
              </div>
              {sweepResult && (
                <p className="mt-2 text-xs font-medium text-emerald-800">{sweepResult}</p>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6 lg:col-span-7">
            <h2 className="text-lg font-semibold">Catálogo Ativo de Recompensas ({rewards.length})</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#E7E7E4] bg-[#F7F7F5] p-4"
                >
                  <div>
                    <span className="label-caps text-emerald-900">
                      {reward.partnerName} · {reward.partnerCategory}
                    </span>
                    <h3 className="mt-1 text-sm font-semibold">{reward.title}</h3>
                    <p className="mt-1 text-xs text-[#6B6B6B]">{reward.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#E7E7E4] pt-3 text-xs">
                    <span className="font-mono font-semibold text-emerald-800">
                      {reward.costEcoPoints} EcoPoints
                    </span>
                    <span className="text-[#6B6B6B]">Estoque: {reward.stock} un.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AI INSIGHT ENGINE FACADE */}
      {activeTab === "insights" && (
        <div className="space-y-6 rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E7E4] pb-4">
            <div>
              <span className="label-caps text-emerald-800">
                Arquitetura Plugável · InsightEngine Facade (ADR-0004)
              </span>
              <h2 className="mt-1 text-xl font-semibold">
                Diagnósticos Executivos de Mobilidade e Infraestrutura
              </h2>
              <p className="text-xs text-[#6B6B6B]">
                 alterne entre provedores em nuvem (Gemini API), modelo local (Ollama) ou motor
                determinístico sem alterar as rotas ou componentes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as InsightProvider)}
                className="rounded-full border border-[#E7E7E4] bg-white px-4 py-2 text-xs font-medium"
              >
                <option value="DETERMINISTIC">Provedor: Motor Determinístico (Local)</option>
                <option value="GEMINI">Provedor: Google Gemini API (Cloud)</option>
                <option value="OLLAMA">Provedor: Ollama Local (Llama 3.2)</option>
              </select>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const created = await generateInsightAction(selectedProvider, institutionalOnly);
                    setInsights((prev) => [created, ...prev]);
                  })
                }
                className="rounded-full bg-[#111111] px-5 py-2 text-xs font-medium text-white hover:bg-emerald-900"
              >
                Gerar Novo Diagnóstico IA
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {insights.length === 0 ? (
              <p className="text-xs text-[#6B6B6B]">
                Clique em &ldquo;Gerar Novo Diagnóstico IA&rdquo; para sintetizar os indicadores
                atuais do PostGIS.
              </p>
            ) : (
              insights.map((insight) => (
                <div
                  key={insight.id}
                  className="space-y-4 rounded-2xl border border-[#E7E7E4] bg-[#F7F7F5] p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="label-caps rounded bg-emerald-100 px-2.5 py-1 text-emerald-950">
                      Provedor: {insight.provider}
                    </span>
                    <span className="font-mono text-xs text-[#6B6B6B]">
                      {new Date(insight.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-[#111111]">
                    {insight.summary}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl bg-white p-3.5">
                      <p className="label-caps text-[#6B6B6B]">Corredores Prioritários</p>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#111111]">
                        {insight.priorityCorridors.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-white p-3.5">
                      <p className="label-caps text-[#6B6B6B]">Ações Recomendadas à Prefeitura</p>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#111111]">
                        {insight.recommendedActions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
