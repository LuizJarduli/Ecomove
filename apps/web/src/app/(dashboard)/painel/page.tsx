import { ManagerDashboard } from "@/components/manager-dashboard";
import {
  ApiError,
  fetchActiveCampusZone,
  fetchAnalyticsOverview,
  fetchHazardReports,
  fetchManagerInsights,
  fetchPendingReviewTrips,
  fetchRewardsCatalog,
  fetchSpatialHeatmap,
  type CampusZone,
} from "@/lib/api";
import { requireSession } from "@/lib/dal";

async function loadActiveZone(token: string): Promise<CampusZone | null> {
  try {
    return await fetchActiveCampusZone(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ institutionalOnly?: string }>;
}) {
  const session = await requireSession();
  if (session.status !== "manager") return null;

  const params = await searchParams;
  const institutionalOnly = params.institutionalOnly === "true";

  const [zone, overview, heatmap, hazardsRes, pendingTripsRes, rewardsRes, insightsRes] =
    await Promise.all([
      loadActiveZone(session.token),
      fetchAnalyticsOverview(session.token, institutionalOnly),
      fetchSpatialHeatmap(session.token, institutionalOnly),
      fetchHazardReports(session.token),
      fetchPendingReviewTrips(session.token),
      fetchRewardsCatalog(session.token),
      fetchManagerInsights(session.token),
    ]);

  return (
    <ManagerDashboard
      zone={zone}
      overview={overview}
      heatmap={heatmap}
      hazards={hazardsRes.hazards}
      pendingTrips={pendingTripsRes.trips}
      rewards={rewardsRes.rewards}
      insights={insightsRes.insights}
      institutionalOnly={institutionalOnly}
    />
  );
}
