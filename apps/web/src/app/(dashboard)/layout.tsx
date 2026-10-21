"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { logout, useAuth } from "@/components/auth-provider";

/** Protects every dashboard route behind a MobilityManager session. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/login");
  }, [auth.status, router]);

  if (auth.status === "loading" || auth.status === "signed-out") {
    return <p className="p-8 text-zinc-500">Carregando…</p>;
  }

  if (auth.status === "forbidden" || auth.status === "error") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-zinc-600">
          {auth.status === "forbidden"
            ? `A conta ${auth.email} não possui perfil de Gestor de Mobilidade.`
            : auth.message}
        </p>
        <button onClick={logout} className="rounded-md bg-zinc-900 px-4 py-2 text-white">
          Sair
        </button>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <span className="font-semibold">EcoMove · Portal do Gestor</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-600">{auth.actor.name ?? auth.actor.email}</span>
          <button onClick={logout} className="underline">
            Sair
          </button>
        </div>
      </header>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
