import type { Polygon } from "geojson";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

export type Actor =
  | {
      role: "COMMUTER";
      id: string;
      email: string;
      name: string | null;
      isInstitutional: boolean;
      ecoPointsBalance: number;
    }
  | { role: "MOBILITY_MANAGER"; id: string; email: string; name: string | null; department: string | null };

export interface CampusZone {
  id: string;
  name: string;
  isActive: boolean;
  boundary: Polygon;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, idToken: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.message ?? "Erro ao comunicar com o servidor.");
  }
  return response.json() as Promise<T>;
}

export const fetchMe = (idToken: string) => request<Actor>("/v1/me", idToken);
export const fetchManagerCampusZones = (idToken: string) =>
  request<CampusZone[]>("/v1/manager/campus-zones", idToken);
