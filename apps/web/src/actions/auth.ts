"use server";

import { redirect } from "next/navigation";
import { ApiError, exchangeIdToken } from "@/lib/api";
import { clearSession, setSession } from "@/lib/session";

export type StartSessionResult = { error: string } | undefined;

/** Exchanges a freshly issued Firebase ID token for an httpOnly session cookie. */
export async function startSession(idToken: string): Promise<StartSessionResult> {
  try {
    await setSession(await exchangeIdToken(idToken));
  } catch (error) {
    return {
      error:
        error instanceof ApiError && error.status === 401
          ? "Credenciais inválidas."
          : "Não foi possível iniciar a sessão.",
    };
  }
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
