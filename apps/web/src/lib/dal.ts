import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ApiError, fetchMe, type Actor } from "./api";
import { getSessionToken } from "./session";

export type ManagerActor = Extract<Actor, { role: "MOBILITY_MANAGER" }>;

export type SessionState =
  | { status: "signed-out" }
  | { status: "forbidden"; email: string }
  | { status: "manager"; actor: ManagerActor; token: string };

/** Resolves the current session once per request. Unexpected failures (5xx, network) are thrown to error.tsx. */
export const getSession = cache(async (): Promise<SessionState> => {
  const token = await getSessionToken();
  if (!token) return { status: "signed-out" };

  try {
    const actor = await fetchMe(token);
    return actor.role === "MOBILITY_MANAGER"
      ? { status: "manager", actor, token }
      : { status: "forbidden", email: actor.email };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 409)) {
      return { status: "signed-out" };
    }
    throw error;
  }
});

/** Data access gate for MobilityManager-only pages; `forbidden` is left to the caller to render. */
export async function requireSession(): Promise<Exclude<SessionState, { status: "signed-out" }>> {
  const session = await getSession();
  if (session.status === "signed-out") redirect("/login");
  return session;
}
