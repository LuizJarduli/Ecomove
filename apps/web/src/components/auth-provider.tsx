"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchMe, type Actor } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "forbidden"; email: string }
  | { status: "error"; message: string }
  | { status: "manager"; actor: Extract<Actor, { role: "MOBILITY_MANAGER" }>; user: User };

const AuthContext = createContext<AuthState>({ status: "loading" });

export function useAuth() {
  return useContext(AuthContext);
}

export async function logout() {
  await signOut(firebaseAuth());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), async (user) => {
      if (!user) return setState({ status: "signed-out" });
      setState({ status: "loading" });
      try {
        const actor = await fetchMe(await user.getIdToken());
        setState(
          actor.role === "MOBILITY_MANAGER"
            ? { status: "manager", actor, user }
            : { status: "forbidden", email: actor.email },
        );
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Erro inesperado.",
        });
      }
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
