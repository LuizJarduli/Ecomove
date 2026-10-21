import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/actions/auth";
import { requireSession } from "@/lib/dal";

/** Server-side gate for every `/painel` route: only a MobilityManager session renders children. */
export default async function PainelLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  if (session.status === "forbidden") {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-5 bg-[#F7F7F5] p-8 text-center text-[#111111]">
        <div className="max-w-md space-y-4 rounded-[24px] border border-[#E7E7E4] bg-[#FCFCFB] p-8">
          <span className="label-caps rounded bg-[#FFDAD6] px-2.5 py-1 text-[#93000A]">403 · Acesso Restrito</span>
          <h1 className="text-2xl font-semibold tracking-tight">Permissão Insuficiente</h1>
          <p className="text-sm text-[#6B6B6B]">
            A conta <strong className="text-[#111111]">{session.email}</strong> está autenticada como usuário da
            mobilidade (<code className="font-mono text-xs">Commuter</code>) e não possui perfil de Gestor de
            Mobilidade.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/"
              className="rounded-full border border-[#E7E7E4] px-5 py-2.5 text-sm font-medium text-[#111111]"
            >
              Apresentação
            </Link>
            <form action={logout}>
              <button className="rounded-full bg-[#111111] px-5 py-2.5 text-sm font-medium text-white">
                Trocar Conta
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#F7F7F5] text-[#111111]">
      <header className="sticky top-0 z-40 border-b border-[#E7E7E4] bg-[#F7F7F5]/85 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-6 md:px-8">
          <div className="flex items-center gap-6">
            <Link href="/painel" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>EcoMove · Painel do Gestor</span>
            </Link>
            <Link href="/" className="text-xs font-medium text-[#6B6B6B] hover:text-[#111111]">
              Ver Apresentação Pública ↗
            </Link>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="label-caps hidden rounded bg-[#E5E2E1] px-2.5 py-1 text-[#111111] sm:inline-block">
              {session.actor.department ?? "Infraestrutura do Campus"}
            </span>
            <span className="text-sm text-[#6B6B6B]">{session.actor.name ?? session.actor.email}</span>
            <form action={logout}>
              <button className="rounded-full border border-[#E7E7E4] bg-[#FCFCFB] px-4 py-1.5 text-xs font-medium text-[#111111] transition-colors hover:bg-[#E5E2E1]">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1280px] flex-1 p-6 md:p-8">{children}</div>
    </div>
  );
}
