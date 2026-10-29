import "server-only";
import type { LineString, Polygon } from "geojson";

const API_URL = process.env.API_URL ?? "http://localhost:3333";

export type Actor =
  | { role: "COMMUTER"; id: string; email: string; name: string | null }
  | {
      role: "MOBILITY_MANAGER";
      id: string;
      email: string;
      name: string | null;
      department: string | null;
    };

export interface CampusZone {
  id: string;
  name: string;
  isActive: boolean;
  boundary: Polygon;
}

export type TransportMode = "WALK" | "BICYCLE" | "PUBLIC_TRANSIT" | "CARPOOL";
export type TripStatus = "RECORDED" | "VALIDATED" | "PENDING_REVIEW" | "REJECTED";
export type HazardCategory =
  | "SIDEWALK_DAMAGE"
  | "BIKE_LANE_OBSTRUCTION"
  | "POOR_LIGHTING"
  | "BUS_STOP_ISSUE"
  | "OTHER";
export type HazardStatus = "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
export type InsightProvider = "GEMINI" | "OLLAMA" | "DETERMINISTIC";

export interface AnalyticsOverview {
  totalCommuters: number;
  institutionalCommuters: number;
  externalCommuters: number;
  totalValidatedTrips: number;
  totalDistanceKm: number;
  totalCo2SavedGrams: number;
  modalSplit: Array<{
    transportMode: TransportMode;
    tripCount: number;
    distanceKm: number;
    co2SavedGrams: number;
  }>;
  hourlyDistribution: Array<{
    hour: number;
    tripCount: number;
  }>;
  hazardSummary: Array<{
    category: HazardCategory;
    status: HazardStatus;
    count: number;
    totalEndorsements: number;
  }>;
}

export interface SpatialHeatmap {
  tripCorridors: Array<{
    id: string;
    transportMode: TransportMode;
    distanceMeters: number;
    co2SavedGrams: number;
    route: LineString;
  }>;
  hazardClusters: Array<{
    id: string;
    category: HazardCategory;
    status: HazardStatus;
    description: string;
    endorsementCount: number;
    weight: number;
    coordinates: [number, number];
  }>;
}

export interface HazardReportItem {
  id: string;
  reporterId: string;
  category: HazardCategory;
  description: string;
  photoUrl: string | null;
  status: HazardStatus;
  endorsementCount: number;
  location: { type: "Point"; coordinates: [number, number] };
  createdAt: string;
  resolvedAt: string | null;
}

export interface TripItem {
  id: string;
  commuterId: string;
  transportMode: TransportMode;
  status: TripStatus;
  distanceMeters: number;
  durationSeconds: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  co2SavedGrams: number;
  ecoPointsEarned: number;
  startedAt: string;
  endedAt: string;
  rejectionReason: string | null;
}

export interface RewardItem {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerCategory: string;
  title: string;
  description: string;
  costEcoPoints: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
}

export interface MobilityInsightItem {
  id: string;
  audience: "MANAGER" | "COMMUTER";
  provider: InsightProvider;
  summary: string;
  priorityCorridors: string[];
  recommendedActions: string[];
  createdAt: string;
}

export interface SessionCredential {
  sessionCookie: string;
  expiresInMs: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    cache: "no-store",
    headers: {
      ...(rest.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.message ?? "Erro ao comunicar com o servidor.");
  }
  return response.json() as Promise<T>;
}

export const fetchMe = (token: string) => request<Actor>("/v1/me", { token });
export const fetchActiveCampusZone = (token: string) =>
  request<CampusZone>("/v1/campus-zones/active", { token });
export const exchangeIdToken = (idToken: string) =>
  request<SessionCredential>("/v1/auth/session", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });

export const fetchAnalyticsOverview = (token: string, institutionalOnly = false) =>
  request<AnalyticsOverview>(
    `/v1/manager/analytics/overview?institutionalOnly=${institutionalOnly ? "true" : "false"}`,
    { token },
  );

export const fetchSpatialHeatmap = (token: string, institutionalOnly = false) =>
  request<SpatialHeatmap>(
    `/v1/manager/analytics/spatial-heatmap?institutionalOnly=${institutionalOnly ? "true" : "false"}`,
    { token },
  );

export const fetchHazardReports = (token: string) =>
  request<{ hazards: HazardReportItem[] }>("/v1/hazards", { token });

export const updateHazardStatus = (
  token: string,
  hazardId: string,
  status: "APPROVED" | "REJECTED" | "RESOLVED",
) =>
  request<HazardReportItem>(`/v1/manager/hazards/${hazardId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });

export const fetchPendingReviewTrips = (token: string) =>
  request<{ trips: TripItem[] }>("/v1/manager/trips?status=PENDING_REVIEW", { token });

export const reviewTripStatus = (
  token: string,
  tripId: string,
  status: "VALIDATED" | "REJECTED",
  rejectionReason?: string,
) =>
  request<TripItem>(`/v1/manager/trips/${tripId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status, rejectionReason }),
  });

export const fetchRewardsCatalog = (token: string) =>
  request<{ rewards: RewardItem[] }>("/v1/rewards", { token });

export const createPartnerAndReward = async (
  token: string,
  input: {
    partnerName: string;
    partnerCategory: string;
    partnerAddress?: string;
    title: string;
    description: string;
    costEcoPoints: number;
    stock: number;
  },
) => {
  const partner = await request<{ id: string }>("/v1/manager/partners", {
    method: "POST",
    token,
    body: JSON.stringify({
      name: input.partnerName,
      category: input.partnerCategory,
      address: input.partnerAddress,
    }),
  });
  return request<RewardItem>("/v1/manager/rewards", {
    method: "POST",
    token,
    body: JSON.stringify({
      partnerId: partner.id,
      title: input.title,
      description: input.description,
      costEcoPoints: input.costEcoPoints,
      stock: input.stock,
    }),
  });
};

export const sweepExpiredRedemptions = (token: string) =>
  request<{ refundedCount: number }>("/v1/manager/redemptions/sweep-expired", {
    method: "POST",
    token,
  });

export const fetchManagerInsights = (token: string) =>
  request<{ insights: MobilityInsightItem[] }>("/v1/manager/analytics/insights", { token });

export const generateManagerInsight = (
  token: string,
  provider: InsightProvider,
  institutionalOnly = false,
) =>
  request<MobilityInsightItem>("/v1/manager/analytics/insights", {
    method: "POST",
    token,
    body: JSON.stringify({ provider, institutionalOnly }),
  });
