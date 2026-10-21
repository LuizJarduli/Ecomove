import "server-only";
import { cookies } from "next/headers";
import type { SessionCredential } from "./api";

export const SESSION_COOKIE = "ecomove_session";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function setSession({ sessionCookie, expiresInMs }: SessionCredential) {
  (await cookies()).set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(expiresInMs / 1000),
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
