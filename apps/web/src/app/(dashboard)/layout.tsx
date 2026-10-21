import type { ReactNode } from "react";
import { logout } from "@/actions/auth";
import { requireSession } from "@/lib/dal";

/** Server-side gate for every dashboard route: only a MobilityManager session renders children. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  if (session.status === "forbidden") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-zinc-600">A conta {session.email} não possui perfil de Gestor de Mobilidade.</p>
        <form action={logout}>
          <button className="rounded-md bg-zinc-900 px-4 py-2 text-white">Sair</button>
        </form>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <span className="font-semibold">EcoMove · Portal do Gestor</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-600">{session.actor.name ?? session.actor.email}</span>
          <form action={logout}>
            <button className="underline">Sair</button>
          </form>
        </div>
      </header>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
