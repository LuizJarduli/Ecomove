import "server-only";
import type { Polygon } from "geojson";

const API_URL = process.env.API_URL ?? "http://localhost:3333";

export type Actor =
  | { role: "COMMUTER"; id: string; email: string; name: string | null }
  | { role: "MOBILITY_MANAGER"; id: string; email: string; name: string | null; department: string | null };

export interface CampusZone {
  id: string;
  name: string;
  isActive: boolean;
  boundary: Polygon;
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
export const fetchActiveCampusZone = (token: string) => request<CampusZone>("/v1/campus-zones/active", { token });
export const exchangeIdToken = (idToken: string) =>
  request<SessionCredential>("/v1/auth/session", { method: "POST", body: JSON.stringify({ idToken }) });
