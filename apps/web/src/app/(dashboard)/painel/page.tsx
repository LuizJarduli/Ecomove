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
  if (!zone) {
    return (
      <div className="rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-8 text-[#6B6B6B]">
        Nenhuma zona de campus ativa cadastrada no PostGIS.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E7E7E4] pb-6">
        <div>
          <span className="label-caps text-emerald-800">Geofence Ativo · PostGIS SRID 4326</span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{zone.name}</h1>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Perímetro oficial utilizado pelo motor espacial (<code className="font-mono text-xs">ST_Intersects</code>)
            para validação de deslocamentos sustentáveis e ocorrências de zeladoria.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#E7E7E4] bg-[#FCFCFB] px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="label-caps text-[#111111]">Status: Ativa</span>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-4">
        <CampusZoneMapLoader zone={zone} />
      </div>
    </section>
  );
}
