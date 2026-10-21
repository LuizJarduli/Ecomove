"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { CampusZoneMapLoader } from "@/components/campus-zone-map-loader";
import { fetchManagerCampusZones, type CampusZone } from "@/lib/api";

export default function CampusZonePage() {
  const auth = useAuth();
  const [zones, setZones] = useState<CampusZone[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "manager") return;
    auth.user
      .getIdToken()
      .then(fetchManagerCampusZones)
      .then(setZones)
      .catch((e: Error) => setError(e.message));
  }, [auth]);

  if (error) return <p role="alert" className="text-red-600">{error}</p>;
  if (!zones) return <p className="text-zinc-500">Carregando zonas do campus…</p>;

  const active = zones.find((zone) => zone.isActive);
  if (!active) return <p className="text-zinc-600">Nenhuma zona de campus ativa cadastrada.</p>;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Zona do Campus</h1>
        <p className="text-sm text-zinc-600">{active.name} — perímetro de validação das viagens.</p>
      </div>
      <CampusZoneMapLoader zone={active} />
    </section>
  );
}
