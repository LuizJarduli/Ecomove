import { CampusZoneMapLoader } from "@/components/campus-zone-map-loader";
import { ApiError, fetchActiveCampusZone, type CampusZone } from "@/lib/api";
import { requireSession } from "@/lib/dal";

async function loadActiveZone(token: string): Promise<CampusZone | null> {
  try {
    return await fetchActiveCampusZone(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function CampusZonePage() {
  const session = await requireSession();
  if (session.status !== "manager") return null;

  const zone = await loadActiveZone(session.token);
  if (!zone) return <p className="text-zinc-600">Nenhuma zona de campus ativa cadastrada.</p>;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Zona do Campus</h1>
        <p className="text-sm text-zinc-600">{zone.name} — perímetro de validação das viagens.</p>
      </div>
      <CampusZoneMapLoader zone={zone} />
    </section>
  );
}
